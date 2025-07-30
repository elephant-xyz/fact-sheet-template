#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../dist/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

const program = new Command();

program
  .name('deploy-production')
  .description('Deploy property fact sheet to elephant.xyz production')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy property to production')
  .requiredOption('-p, --property-id <id>', 'Property ID (e.g., 52434205310037080)')
  .option('-u, --url <url>', 'URL to download from (IPFS or HTTP)')
  .option('-l, --local-path <path>', 'Local path to property directory')
  .option('--dry-run', 'Show what would be deployed without actually deploying')
  .option('--log-file <path>', 'Path to log file (default: deploy-production.log)')
  .option('--verbose', 'Verbose output')
  .option('--quiet', 'Suppress output except errors')
  .action(async (options) => {
    try {
      await deployToProduction(options);
    } catch (error) {
      console.error('Production deployment failed:', error.message);
      process.exit(1);
    }
  });

async function deployToProduction(options) {
  const { propertyId, url, localPath, dryRun = false, logFile = 'deploy-production.log', verbose = false, quiet = false } = options;

  // Create logger
  const logger = new Logger({
    quiet: quiet,
    verbose: verbose,
    logFile: logFile
  });

  logger.info(`🚀 Deploying property ${propertyId} to elephant.xyz production`);

  // Validate environment variables
  if (!process.env.NETLIFY_SITE_ID) {
    logger.error('NETLIFY_SITE_ID environment variable is required');
    logger.finalize();
    throw new Error('NETLIFY_SITE_ID environment variable is required');
  }

  if (!process.env.NETLIFY_TOKEN) {
    logger.error('NETLIFY_TOKEN environment variable is required');
    logger.finalize();
    throw new Error('NETLIFY_TOKEN environment variable is required');
  }

  if (dryRun) {
    logger.info('🔍 DRY RUN MODE - No actual deployment will occur');
    logger.finalize();
    return;
  }

  // Validate input
  if (!url && !localPath) {
    logger.error('Either --url or --local-path must be provided');
    logger.finalize();
    throw new Error('Either --url or --local-path must be provided');
  }

  if (url && localPath) {
    logger.error('Cannot provide both --url and --local-path');
    logger.finalize();
    throw new Error('Cannot provide both --url and --local-path');
  }

  // Create deployment structure
  const deployDir = path.join(process.cwd(), 'deploy-temp');
  const homesDir = path.join(deployDir, 'homes');
  const propertyDir = path.join(homesDir, propertyId);
  const sharedPublicDir = path.join(homesDir, 'public');

  // Clean up previous deployment
  await fs.remove(deployDir);

  // Create deployment structure
  await fs.ensureDir(propertyDir);
  await fs.ensureDir(sharedPublicDir);

  let sourceDir;

  if (url) {
    // Download from URL
    logger.info(`📥 Downloading from URL: ${url}`);
    sourceDir = await downloadFromUrl(url);
  } else {
    // Use local path
    logger.info(`📁 Using local path: ${localPath}`);
    sourceDir = path.resolve(localPath);
    
    if (!await fs.pathExists(sourceDir)) {
      logger.error(`Local path does not exist: ${localPath}`);
      logger.finalize();
      throw new Error(`Local path does not exist: ${localPath}`);
    }
  }

  // Copy property files (excluding public folder)
  logger.info(`📦 Copying property files...`);
  const files = await fs.readdir(sourceDir);
  for (const file of files) {
    if (file !== 'public') { // Don't copy the public folder from source
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(propertyDir, file);
      await fs.copy(sourcePath, targetPath);
    }
  }

  // Copy assets from templates to shared public directory
  logger.info(`📦 Copying assets to shared public directory...`);
  const assetsSource = path.join(process.cwd(), 'templates', 'assets');
  
  // Copy CSS and JS directories
  const cssSource = path.join(assetsSource, 'css');
  const cssTarget = path.join(sharedPublicDir, 'css');
  if (await fs.pathExists(cssSource)) {
    await fs.copy(cssSource, cssTarget);
    logger.info(`✅ Copied CSS assets to shared directory`);
  }

  const jsSource = path.join(assetsSource, 'js');
  const jsTarget = path.join(sharedPublicDir, 'js');
  if (await fs.pathExists(jsSource)) {
    await fs.copy(jsSource, jsTarget);
    logger.info(`✅ Copied JS assets to shared directory`);
  }

  // Copy static assets (SVGs, images)
  const staticSource = path.join(assetsSource, 'static');
  if (await fs.pathExists(staticSource)) {
    // Copy static assets directly to public directory (flatten the structure)
    const staticFiles = await fs.readdir(staticSource);
    for (const file of staticFiles) {
      const sourcePath = path.join(staticSource, file);
      const targetPath = path.join(sharedPublicDir, file);
      await fs.copy(sourcePath, targetPath);
    }
    logger.info(`✅ Copied static assets to shared directory`);
  }

  // Fix HTML to use shared public paths
  const htmlPath = path.join(propertyDir, 'index.html');
  if (await fs.pathExists(htmlPath)) {
    let html = await fs.readFile(htmlPath, 'utf8');
    
    // Replace CDN URLs with absolute shared public paths
    html = html.replace(/https:\/\/elephant\.xyz\/homes\/public\//g, '/homes/public/');
    
    // Fix local public paths to use absolute shared public directory
    html = html.replace(/\.\/public\//g, '/homes/public/');
    
    // Also fix any remaining relative paths that might have been missed
    html = html.replace(/\.\/homes\/public\//g, '/homes/public/');
    
    // Remove problematic Cloudflare script
    html = html.replace(/<script data-cfasync="false" src="\/cdn-cgi\/scripts\/[^"]*"><\/script>/g, '');
    
    // Write the fixed HTML
    await fs.writeFile(htmlPath, html);
    logger.info(`✅ Fixed HTML to use shared assets`);
  }

  // Add a timestamp file to force Netlify to recognize changes
  const timestampFile = path.join(deployDir, 'deploy-timestamp.txt');
  await fs.writeFile(timestampFile, `Deployed at: ${new Date().toISOString()}`);
  logger.info(`✅ Added timestamp to force deployment`);

  // Update sitemap in deploy directory
  logger.info(`🗺️  Updating sitemap...`);
  await updateSitemap(propertyId, deployDir, logger);

  // Deploy to Netlify
  logger.info(`🌐 Deploying to Netlify...`);

  try {
    const deployCommand = `netlify deploy --prod --dir=${deployDir} --site=${process.env.NETLIFY_SITE_ID} --auth=${process.env.NETLIFY_TOKEN}`;
    const { stdout, stderr } = await execAsync(deployCommand);

    if (stderr) {
      logger.warn('⚠️  Netlify warnings:', stderr);
    }

    logger.info('✅ Successfully deployed to Netlify');
    logger.info(`🌐 Your property is now live at: https://elephant.xyz/homes/${propertyId}`);
    logger.info(`🌐 Sitemap available at: https://elephant.xyz/sitemap.xml`);

  } catch (error) {
    logger.error('❌ Netlify deployment failed:', error.message);
    logger.finalize();
    throw error;
  }

  // Clean up
  if (url && sourceDir) {
    await fs.remove(sourceDir);
  }
  logger.finalize();
}

async function downloadFromUrl(url) {
  const tempDir = path.join(process.cwd(), 'temp-download');
  await fs.ensureDir(tempDir);

  try {
    if (url.startsWith('ipfs://') || url.includes('ipfs')) {
      // Handle IPFS URLs
      const cid = extractCidFromUrl(url);
      console.log(`📥 Downloading from IPFS CID: ${cid}`);
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        // Try multiple IPFS gateways
        const gateways = [
          'https://ipfs.io/ipfs/',
          'https://gateway.pinata.cloud/ipfs/',
          'https://cloudflare-ipfs.com/ipfs/',
          'https://dweb.link/ipfs/'
        ];

        for (const gateway of gateways) {
          try {
            console.log(`🔄 Trying gateway: ${gateway}`);
            const downloadUrl = `${gateway}${cid}`;
            
            // Use curl to download
            const curlCommand = `curl -L -o "${tempDir}/temp.tar.gz" "${downloadUrl}"`;
            await execAsync(curlCommand);
            
            // Extract if it's a tar.gz
            if (await fs.pathExists(path.join(tempDir, 'temp.tar.gz'))) {
              await execAsync(`cd "${tempDir}" && tar -xzf temp.tar.gz`);
              await fs.remove(path.join(tempDir, 'temp.tar.gz'));
            }
            
            console.log(`✅ Successfully downloaded from ${gateway}`);
            break;
          } catch (error) {
            console.log(`❌ Failed to download from ${gateway}: ${error.message}`);
            continue;
          }
        }

        // Find the extracted directory
        const files = await fs.readdir(tempDir);
        const extractedDir = files.find(file => {
          const stat = fs.statSync(path.join(tempDir, file));
          return stat.isDirectory();
        });

        if (!extractedDir) {
          throw new Error('No extracted directory found');
        }

        return path.join(tempDir, extractedDir);

      } catch (error) {
        throw new Error(`Failed to download from IPFS: ${error.message}`);
      }
    } else {
      // Handle HTTP URLs
      console.log(`📥 Downloading from HTTP URL: ${url}`);
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        const curlCommand = `curl -L -o "${tempDir}/temp.tar.gz" "${url}"`;
        await execAsync(curlCommand);
        
        // Extract if it's a tar.gz
        if (await fs.pathExists(path.join(tempDir, 'temp.tar.gz'))) {
          await execAsync(`cd "${tempDir}" && tar -xzf temp.tar.gz`);
          await fs.remove(path.join(tempDir, 'temp.tar.gz'));
        }
        
        // Find the extracted directory
        const files = await fs.readdir(tempDir);
        const extractedDir = files.find(file => {
          const stat = fs.statSync(path.join(tempDir, file));
          return stat.isDirectory();
        });

        if (!extractedDir) {
          throw new Error('No extracted directory found');
        }

        return path.join(tempDir, extractedDir);

      } catch (error) {
        throw new Error(`Failed to download from HTTP URL: ${error.message}`);
      }
    }
  } catch (error) {
    await fs.remove(tempDir);
    throw error;
  }
}

function extractCidFromUrl(url) {
  // Extract CID from various IPFS URL formats
  const ipfsMatch = url.match(/ipfs\/([a-zA-Z0-9]+)/);
  if (ipfsMatch) {
    return ipfsMatch[1];
  }
  
  // If it's just a CID
  if (/^[a-zA-Z0-9]+$/.test(url)) {
    return url;
  }
  
  throw new Error('Could not extract CID from URL');
}

async function updateSitemap(propertyId, deployDir, logger) {
  const sitemapPath = path.join(deployDir, 'sitemap.xml');
  let sitemapContent = '';
  
  // First try to read existing sitemap from deploy directory
  if (await fs.pathExists(sitemapPath)) {
    sitemapContent = await fs.readFile(sitemapPath, 'utf8');
    logger.info(`📖 Found existing sitemap.xml in deploy directory`);
  } else {
    // Try to read from project root
    const rootSitemapPath = path.join(process.cwd(), 'sitemap.xml');
    if (await fs.pathExists(rootSitemapPath)) {
      sitemapContent = await fs.readFile(rootSitemapPath, 'utf8');
      logger.info(`📖 Found existing sitemap.xml in project root`);
    } else {
      // Create new sitemap
      sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
      logger.info(`📝 Creating new sitemap.xml`);
    }
  }

  // Check if property already exists in sitemap
  const propertyUrl = `https://elephant.xyz/homes/${propertyId}`;
  if (sitemapContent.includes(propertyUrl)) {
    logger.info(`✅ Property ${propertyId} already exists in sitemap`);
    return;
  }

  // Add new property to sitemap
  const newUrlEntry = `  <url>
    <loc>${propertyUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  // Insert before closing urlset tag
  const updatedSitemapContent = sitemapContent.replace(
    '</urlset>',
    `${newUrlEntry}
</urlset>`
  );

  await fs.writeFile(sitemapPath, updatedSitemapContent);
  logger.info(`✅ Added property ${propertyId} to sitemap`);
}

program.parse(); 