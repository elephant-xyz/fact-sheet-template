#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Function to get Logger class
async function getLogger() {
  try {
    const loggerModule = await import('../dist/lib/logger.js');
    return loggerModule.Logger;
  } catch (error) {
    // Fallback to lib directory
    const loggerModule = await import('../lib/logger.js');
    return loggerModule.Logger;
  }
}

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
      // Create a basic logger for error reporting
      const Logger = await getLogger();
      const logger = new Logger({
        quiet: false,
        verbose: false,
        logFile: 'deploy-production-error.log'
      });
      logger.error('Production deployment failed:', error.message);
      logger.finalize();
      process.exit(1);
    }
  });

program
  .command('remove-sitemap')
  .description('Remove property from sitemap')
  .requiredOption('-p, --property-id <id>', 'Property ID to remove from sitemap')
  .option('--log-file <path>', 'Path to log file (default: deploy-production.log)')
  .option('--verbose', 'Verbose output')
  .option('--quiet', 'Suppress output except errors')
  .option('--dry-run', 'Show what would be removed without actually removing')
  .option('--remove-files', 'Also remove property files from deployment')
  .action(async (options) => {
    try {
      await removeFromSitemap(options);
    } catch (error) {
      // Create a basic logger for error reporting
      const Logger = await getLogger();
      const logger = new Logger({
        quiet: false,
        verbose: false,
        logFile: 'deploy-production-error.log'
      });
      logger.error('Sitemap removal failed:', error.message);
      logger.finalize();
      process.exit(1);
    }
  });

program
  .command('remove-property')
  .description('Completely remove property from sitemap and deployment')
  .requiredOption('-p, --property-id <id>', 'Property ID to remove')
  .option('--log-file <path>', 'Path to log file (default: deploy-production.log)')
  .option('--verbose', 'Verbose output')
  .option('--quiet', 'Suppress output except errors')
  .option('--dry-run', 'Show what would be removed without actually removing')
  .action(async (options) => {
    try {
      await removeProperty(options);
    } catch (error) {
      // Create a basic logger for error reporting
      const Logger = await getLogger();
      const logger = new Logger({
        quiet: false,
        verbose: false,
        logFile: 'deploy-production-error.log'
      });
      logger.error('Property removal failed:', error.message);
      logger.finalize();
      process.exit(1);
    }
  });

async function deployToProduction(options) {
  const { propertyId, url, localPath, dryRun = false, logFile = 'deploy-production.log', verbose = false, quiet = false } = options;
  
  // Get Logger class and create logger
  const Logger = await getLogger();
  const logger = new Logger({
    quiet: quiet,
    verbose: verbose,
    logFile: logFile
  });
  
  // Check if Netlify CLI is installed
  try {
    await execAsync('netlify --version');
  } catch (error) {
    logger.info('📦 Netlify CLI not found, installing...');
    try {
      await execAsync('npm install -g netlify-cli');
      logger.success('✅ Netlify CLI installed successfully');
    } catch (installError) {
      logger.error('❌ Failed to install Netlify CLI:', installError.message);
      logger.error('Please install Netlify CLI manually: npm install -g netlify-cli');
      process.exit(1);
    }
  }

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
    sourceDir = await downloadFromUrl(url, logger);
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

  // Download and copy images from IPFS content to shared public directory
  if (url) {
    logger.info(`📥 Downloading images from IPFS content...`);
    const imageFiles = await fs.readdir(sourceDir);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    
    for (const file of imageFiles) {
      const fileExt = path.extname(file).toLowerCase();
      if (imageExtensions.includes(fileExt)) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(sharedPublicDir, file);
        await fs.copy(sourcePath, targetPath);
        logger.info(`✅ Copied image: ${file} to shared public directory`);
      }
    }
    
    // Download only referenced assets from IPFS
    logger.info(`📥 Downloading referenced assets from IPFS...`);
    const cid = extractCidFromUrl(url);
    const ipfsGateway = `https://${cid}.ipfs.dweb.link/`;
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Get all referenced assets from HTML
      const htmlContent = await fs.readFile(path.join(propertyDir, 'index.html'), 'utf8');
      const imageMatches = htmlContent.match(/src="[^"]*\.(jpg|jpeg|png|gif|webp|svg)"/g) || [];
      const hrefMatches = htmlContent.match(/href="[^"]*\.(jpg|jpeg|png|gif|webp|svg)"/g) || [];
      const allMatches = [...imageMatches, ...hrefMatches];
      
      // Extract unique filenames
      const assetFiles = new Set();
      for (const match of allMatches) {
        const filename = match.match(/[^"]*\/([^"]+)/)?.[1];
        if (filename) {
          assetFiles.add(filename);
        }
      }
      
      logger.info(`📥 Attempting to download ${assetFiles.size} referenced assets from IPFS...`);
      
      // Download all discovered assets
      let downloadedCount = 0;
      for (const filename of assetFiles) {
        const downloadUrl = `${ipfsGateway}${filename}`;
        const targetPath = path.join(sharedPublicDir, filename);
        
        try {
          logger.info(`📥 Trying to download: ${filename}`);
          const curlCommand = `curl -L -o "${targetPath}" "${downloadUrl}"`;
          await execAsync(curlCommand);
          
          // Verify download
          const stats = await fs.stat(targetPath);
          if (stats.size > 0) {
            logger.info(`✅ Downloaded from IPFS: ${filename}`);
            downloadedCount++;
          } else {
            // Remove empty file
            await fs.remove(targetPath);
            logger.warn(`⚠️  Empty file, skipping: ${filename}`);
          }
        } catch (error) {
          logger.warn(`⚠️  Failed to download: ${filename} - ${error.message}`);
          // Remove failed download file if it exists
          if (await fs.pathExists(targetPath)) {
            await fs.remove(targetPath);
          }
        }
      }
      
      logger.info(`✅ Successfully downloaded ${downloadedCount} assets from IPFS`);
      
    } catch (error) {
      logger.warn(`⚠️  Could not download assets from IPFS: ${error.message}`);
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
    
    // Fix image paths from downloaded HTML (they reference files in the same directory)
    // These files are actually in the shared public directory
    html = html.replace(/src="\.\/([^"]+)"/g, 'src="/homes/public/$1"');
    html = html.replace(/href="\.\/([^"]+)"/g, 'href="/homes/public/$1"');
    
    // Fix any remaining relative paths for images and assets
    html = html.replace(/src="([^"]*\.(jpg|jpeg|png|gif|webp|svg))"/g, (match, filename) => {
      if (filename.startsWith('/')) {
        return match; // Already absolute
      }
      if (filename.startsWith('http')) {
        return match; // Already external URL
      }
      return `src="/homes/public/${filename}"`;
    });
    
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
    logger.error('❌ Netlify CLI deployment failed, trying alternative method...');
    
    // Fallback: Try using curl to upload to Netlify
    try {
      logger.info('🔄 Trying alternative deployment method...');
      
      // Create a zip file of the deployment directory
      const zipPath = path.join(process.cwd(), 'deploy-temp.zip');
      await execAsync(`cd "${deployDir}" && zip -r "${zipPath}" .`);
      
      // Upload using Netlify API
      const uploadUrl = `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/deploys`;
      const uploadCommand = `curl -H "Authorization: Bearer ${process.env.NETLIFY_TOKEN}" -H "Content-Type: application/zip" --data-binary "@${zipPath}" "${uploadUrl}"`;
      
      const { stdout: uploadResult } = await execAsync(uploadCommand);
      const result = JSON.parse(uploadResult);
      
      if (result.url) {
        logger.success('✅ Successfully deployed using alternative method');
        logger.info(`🌐 Your property is now live at: https://elephant.xyz/homes/${propertyId}`);
        logger.info(`🌐 Sitemap available at: https://elephant.xyz/sitemap.xml`);
      } else {
        throw new Error('Upload failed - no URL returned');
      }
      
      // Clean up zip file
      await fs.remove(zipPath);
      
    } catch (fallbackError) {
      logger.error('❌ Alternative deployment method also failed:', fallbackError.message);
      logger.error('❌ Netlify deployment failed:', error.message);
      logger.finalize();
      throw error;
    }
  }

  // Clean up
  if (url && sourceDir) {
    await fs.remove(sourceDir);
  }
  logger.finalize();
}

async function removeFromSitemap(options) {
  const { propertyId, logFile = 'deploy-production.log', verbose = false, quiet = false, dryRun = false, removeFiles = false } = options;

  // Get Logger class and create logger
  const Logger = await getLogger();
  const logger = new Logger({
    quiet: quiet,
    verbose: verbose,
    logFile: logFile
  });

  logger.info(`🗑️  Removing property ${propertyId} from sitemap`);

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
    logger.info('🔍 DRY RUN MODE - No actual sitemap removal will occur');
    logger.finalize();
    return;
  }

  let sitemapContent = '';
  
  // Always try to read from production sitemap first
  try {
    logger.info(`📥 Fetching current sitemap from production...`);
    const https = await import('https');
    const productionSitemap = await new Promise((resolve, reject) => {
      https.get('https://elephant.xyz/sitemap.xml', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    sitemapContent = productionSitemap;
    logger.info(`✅ Successfully fetched production sitemap`);
  } catch (error) {
    logger.error(`❌ Could not fetch production sitemap: ${error.message}`);
    logger.finalize();
    throw new Error(`Could not fetch production sitemap: ${error.message}`);
  }

  // Check if property already exists in sitemap
  const propertyUrl = `https://elephant.xyz/homes/${propertyId}`;
  if (!sitemapContent.includes(propertyUrl)) {
    logger.info(`✅ Property ${propertyId} not found in sitemap, no action needed.`);
    logger.finalize();
    return;
  }

  // Remove the property URL entry
  let updatedSitemapContent = sitemapContent.replace(
    new RegExp(`  <url>\\s*<loc>https://elephant\\.xyz/homes/${propertyId}</loc>\\s*<lastmod>[^<]+</lastmod>\\s*<changefreq>monthly</changefreq>\\s*<priority>0\\.8</priority>\\s*</url>`, 'g'),
    ''
  );

  // Clean up any extra whitespace
  updatedSitemapContent = updatedSitemapContent.replace(/\n\s*\n/g, '\n');

  // Write to local sitemap for deployment
  const localSitemapPath = path.join(process.cwd(), 'sitemap.xml');
  await fs.writeFile(localSitemapPath, updatedSitemapContent);
  logger.info(`✅ Removed property ${propertyId} from sitemap`);

  // Deploy sitemap to Netlify
  logger.info(`🌐 Deploying updated sitemap to Netlify...`);
  try {
    const deployCommand = `netlify deploy --prod --dir=${process.cwd()} --site=${process.env.NETLIFY_SITE_ID} --auth=${process.env.NETLIFY_TOKEN}`;
    const { stdout, stderr } = await execAsync(deployCommand);

    if (stderr) {
      logger.warn('⚠️  Netlify warnings:', stderr);
    }

    logger.info('✅ Successfully deployed updated sitemap to Netlify');
    logger.info(`🌐 Updated sitemap available at: https://elephant.xyz/sitemap.xml`);
  } catch (error) {
    logger.error('❌ Netlify sitemap deployment failed:', error.message);
    throw error;
  }

  // If --remove-files is true, remove the property files from the deployment directory
  if (removeFiles) {
    const propertyDir = path.join(process.cwd(), 'deploy-temp', 'homes', propertyId);
    if (await fs.pathExists(propertyDir)) {
      logger.info(`🗑️  Removing property files from: ${propertyDir}`);
      await fs.remove(propertyDir);
      logger.info(`✅ Property files removed from: ${propertyDir}`);
    } else {
      logger.warn(`⚠️  Property files not found at: ${propertyDir}, no files to remove.`);
    }
  }

  logger.finalize();
}

async function removeProperty(options) {
  const { propertyId, logFile = 'deploy-production.log', verbose = false, quiet = false, dryRun = false } = options;

  // Get Logger class and create logger
  const Logger = await getLogger();
  const logger = new Logger({
    quiet: quiet,
    verbose: verbose,
    logFile: logFile
  });

  logger.info(`🗑️  Completely removing property ${propertyId} from sitemap and deployment`);

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
    logger.info('🔍 DRY RUN MODE - No actual property removal will occur');
    logger.finalize();
    return;
  }

  // Remove from sitemap
  await removeFromSitemap({ propertyId, logFile, verbose, quiet, dryRun: false, removeFiles: false });

  // Remove from deployment directory
  const propertyDir = path.join(process.cwd(), 'deploy-temp', 'homes', propertyId);
  if (await fs.pathExists(propertyDir)) {
    logger.info(`🗑️  Removing property files from: ${propertyDir}`);
    await fs.remove(propertyDir);
    logger.info(`✅ Property files removed from: ${propertyDir}`);
  } else {
    logger.warn(`⚠️  Property files not found at: ${propertyDir}, no files to remove.`);
  }

  logger.finalize();
}

async function downloadFromUrl(url, logger) {
  const tempDir = path.join(process.cwd(), 'temp-download');
  
  // Clean up any existing content from previous runs
  if (await fs.pathExists(tempDir)) {
    logger.info(`🧹 Cleaning up previous download directory`);
    await fs.remove(tempDir);
  }
  
  await fs.ensureDir(tempDir);

  try {
    if (url.startsWith('ipfs://') || url.includes('ipfs')) {
      // Handle IPFS URLs
      const cid = extractCidFromUrl(url);
      logger.info(`📥 Downloading from IPFS CID: ${cid}`);
      
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
            logger.info(`🔄 Trying gateway: ${gateway}`);
            const downloadUrl = `${gateway}${cid}`;
            
            // Use curl to download with timeout and retry
            const curlCommand = `curl -L --max-time 30 --retry 3 --retry-delay 2 -o "${tempDir}/downloaded-content" "${downloadUrl}"`;
            
            // Remove any existing downloaded file
            const downloadedFile = path.join(tempDir, 'downloaded-content');
            if (await fs.pathExists(downloadedFile)) {
              await fs.remove(downloadedFile);
            }
            
            await execAsync(curlCommand);
            
            // Check what type of file we downloaded
            const fileTypeCommand = `file "${tempDir}/downloaded-content"`;
            const { stdout: fileType } = await execAsync(fileTypeCommand);
            
            if (fileType.includes('HTML') || fileType.includes('text')) {
              // It's an HTML file, create a directory structure
              const extractedDir = path.join(tempDir, 'extracted');
              await fs.ensureDir(extractedDir);
              
              // Move the HTML file to index.html
              await fs.move(path.join(tempDir, 'downloaded-content'), path.join(extractedDir, 'index.html'));
              
              logger.info(`✅ Successfully downloaded HTML from ${gateway}`);
              return extractedDir;
            } else if (fileType.includes('gzip') || fileType.includes('tar')) {
              // It's a compressed file, extract it
              await execAsync(`cd "${tempDir}" && tar -xzf downloaded-content`);
              await fs.remove(path.join(tempDir, 'downloaded-content'));
              
              // Find the extracted directory
              const files = await fs.readdir(tempDir);
              const extractedDir = files.find(file => {
                const stat = fs.statSync(path.join(tempDir, file));
                return stat.isDirectory();
              });

              if (!extractedDir) {
                throw new Error('No extracted directory found');
              }

              logger.info(`✅ Successfully downloaded and extracted from ${gateway}`);
              return path.join(tempDir, extractedDir);
            } else {
              logger.warn(`⚠️  Unknown file type: ${fileType}`);
              continue;
            }
          } catch (error) {
            logger.warn(`❌ Failed to download from ${gateway}: ${error.message}`);
            continue;
          }
        }

        throw new Error('Failed to download from all gateways');

      } catch (error) {
        throw new Error(`Failed to download from IPFS: ${error.message}`);
      }
    } else {
      // Handle HTTP URLs
      logger.info(`📥 Downloading from HTTP URL: ${url}`);
      
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        const curlCommand = `curl -L --max-time 30 --retry 3 --retry-delay 2 -o "${tempDir}/downloaded-content" "${url}"`;
        
        // Remove any existing downloaded file
        const downloadedFile = path.join(tempDir, 'downloaded-content');
        if (await fs.pathExists(downloadedFile)) {
          await fs.remove(downloadedFile);
        }
        
        await execAsync(curlCommand);
        
        // Check what type of file we downloaded
        const fileTypeCommand = `file "${tempDir}/downloaded-content"`;
        const { stdout: fileType } = await execAsync(fileTypeCommand);
        
        if (fileType.includes('HTML') || fileType.includes('text')) {
          // It's an HTML file, create a directory structure
          const extractedDir = path.join(tempDir, 'extracted');
          await fs.ensureDir(extractedDir);
          
          // Move the HTML file to index.html
          await fs.move(path.join(tempDir, 'downloaded-content'), path.join(extractedDir, 'index.html'));
          
          logger.info(`✅ Successfully downloaded HTML from HTTP URL`);
          return extractedDir;
        } else if (fileType.includes('gzip') || fileType.includes('tar')) {
          // It's a compressed file, extract it
          await execAsync(`cd "${tempDir}" && tar -xzf downloaded-content`);
          await fs.remove(path.join(tempDir, 'downloaded-content'));
          
          // Find the extracted directory
          const files = await fs.readdir(tempDir);
          const extractedDir = files.find(file => {
            const stat = fs.statSync(path.join(tempDir, file));
            return stat.isDirectory();
          });

          if (!extractedDir) {
            throw new Error('No extracted directory found');
          }

          logger.info(`✅ Successfully downloaded and extracted from HTTP URL`);
          return path.join(tempDir, extractedDir);
        } else {
          throw new Error(`Unknown file type: ${fileType}`);
        }

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
  try {
    const sitemapPath = path.join(deployDir, 'sitemap.xml');
    let sitemapContent = '';
    
    logger.info(`🗺️  Starting sitemap update for property ${propertyId}`);
    logger.info(`📁 Sitemap will be written to: ${sitemapPath}`);
    
    // Always try to read from production sitemap first
    try {
      logger.info(`📥 Fetching current sitemap from production...`);
      const https = await import('https');
      const productionSitemap = await new Promise((resolve, reject) => {
        https.get('https://elephant.xyz/sitemap.xml', (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }).on('error', reject);
      });
      
      logger.info(`📥 Received ${productionSitemap.length} characters from production sitemap`);
      
      // Check if the response is actually XML (not HTML error page)
      if (productionSitemap.trim().startsWith('<?xml') || productionSitemap.trim().startsWith('<urlset')) {
        sitemapContent = productionSitemap;
        logger.info(`✅ Successfully fetched production sitemap`);
      } else {
        logger.warn(`⚠️  Production sitemap returned HTML instead of XML, creating new sitemap`);
        logger.warn(`⚠️  First 100 chars: ${productionSitemap.substring(0, 100)}`);
        throw new Error('Production sitemap is not valid XML');
      }
    } catch (error) {
      logger.warn(`⚠️  Could not fetch production sitemap: ${error.message}`);
      logger.info(`📝 Creating new sitemap.xml`);
      
      // Create new sitemap if production fetch fails
      sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
    }

    // Check if property already exists in sitemap
    const propertyUrl = `https://elephant.xyz/homes/${propertyId}`;
    const currentTime = new Date().toISOString();
    
    if (sitemapContent.includes(propertyUrl)) {
      logger.info(`✅ Property ${propertyId} already exists in sitemap, updating timestamp`);
      
      // Update the lastmod timestamp for existing property
      const updatedSitemapContent = sitemapContent.replace(
        new RegExp(`(<url>\\s*<loc>${propertyUrl}</loc>\\s*<lastmod>)[^<]*(</lastmod>)`, 'g'),
        `$1${currentTime}$2`
      );
      
      if (updatedSitemapContent !== sitemapContent) {
        sitemapContent = updatedSitemapContent;
        logger.info(`✅ Updated lastmod timestamp for property ${propertyId}`);
      } else {
        logger.info(`⚠️  Could not update timestamp (regex didn't match)`);
      }
    } else {
      // Add new property to sitemap
      const newUrlEntry = `  <url>
    <loc>${propertyUrl}</loc>
    <lastmod>${currentTime}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

      // Insert before closing urlset tag
      sitemapContent = sitemapContent.replace(
        '</urlset>',
        `${newUrlEntry}
</urlset>`
      );
      
      logger.info(`✅ Added property ${propertyId} to sitemap`);
    }

    logger.info(`📝 Writing sitemap to: ${sitemapPath}`);
    await fs.writeFile(sitemapPath, sitemapContent);
    
    // Verify the file was created
    if (await fs.pathExists(sitemapPath)) {
      const stats = await fs.stat(sitemapPath);
      logger.info(`✅ Successfully wrote sitemap (${stats.size} bytes)`);
    } else {
      throw new Error('Sitemap file was not created');
    }
  } catch (error) {
    logger.error(`❌ Failed to update sitemap: ${error.message}`);
    throw error;
  }
}

program.parse(); 