#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

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

// Load environment variables
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
}

const program = new Command();

program
  .name('deploy-to-s3')
  .description('Deploy HTML and assets to S3 from local folder or IPFS')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy to S3')
  .requiredOption('-p, --property-id <id>', 'Property ID')
  .option('-u, --url <url>', 'IPFS URL to download from')
  .option('-l, --local-path <path>', 'Local path to property directory')
  .option('--dry-run', 'Show what would be deployed without actually deploying')
  .option('--log-file <path>', 'Path to log file (default: deploy-s3.log)')
  .option('--verbose', 'Verbose output')
  .option('--quiet', 'Suppress output except errors')
  .action(async (options) => {
    try {
      await deployToS3(options);
    } catch (error) {
      // Create a basic logger for error reporting
      const Logger = await getLogger();
      const logger = new Logger({
        quiet: false,
        verbose: false,
        logFile: 'deploy-s3-error.log'
      });
      logger.error('S3 deployment failed:', error.message);
      logger.finalize();
      process.exit(1);
    }
  });

program
  .command('deploy-from-csv')
  .description('Deploy multiple properties from CSV file')
  .requiredOption('-c, --csv-file <path>', 'Path to CSV file (upload-results.csv)')
  .option('--dry-run', 'Show what would be deployed without actually deploying')
  .option('--log-file <path>', 'Path to log file (default: deploy-s3-csv.log)')
  .option('--verbose', 'Verbose output')
  .option('--quiet', 'Suppress output except errors')
  .action(async (options) => {
    try {
      await deployFromCSV(options);
    } catch (error) {
      // Create a basic logger for error reporting
      const Logger = await getLogger();
      const logger = new Logger({
        quiet: false,
        verbose: false,
        logFile: 'deploy-s3-csv-error.log'
      });
      logger.error('S3 CSV deployment failed:', error.message);
      logger.finalize();
      process.exit(1);
    }
  });

async function deployToS3(options) {
  const { 
    propertyId, 
    url, 
    localPath, 
    logFile = 'deploy-s3.log', 
    verbose = false, 
    quiet = false, 
    dryRun = false 
  } = options;

  // Load environment variables
  loadEnv();

  // Get Logger class and create logger
  const Logger = await getLogger();
  const logger = new Logger({
    quiet: quiet,
    verbose: verbose,
    logFile: logFile
  });

  logger.info(`🚀 Deploying property ${propertyId} to S3`);

  // Validate environment variables
  const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION', 'S3_BUCKET'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`${envVar} environment variable is required`);
      logger.finalize();
      process.exit(1);
    }
  }

  const s3Bucket = process.env.S3_BUCKET;
  const awsRegion = process.env.AWS_DEFAULT_REGION;

  try {
    let sourceDir;

    if (url) {
      // Download from IPFS
      logger.info(`📥 Downloading from IPFS URL: ${url}`);
      sourceDir = await downloadFromIPFS(url, logger);
    } else if (localPath) {
      // Use local path
      logger.info(`📁 Using local path: ${localPath}`);
      if (!fs.existsSync(localPath)) {
        throw new Error(`Local path does not exist: ${localPath}`);
      }
      sourceDir = localPath;
    } else {
      throw new Error('Either --url or --local-path must be provided');
    }

    // Process the source directory
    const deployDir = path.join(process.cwd(), 's3-deploy-temp');
    await fs.ensureDir(deployDir);

    // Copy files to deployment directory and flatten structure
    await copyAndFlatten(sourceDir, deployDir, logger);
    logger.info(`📦 Copied and flattened files to deployment directory`);

    // Set property ID in environment for asset path fixing
    process.env.PROPERTY_ID = propertyId;

    // Fix asset paths for S3
    await fixAssetPaths(deployDir, logger);

    if (dryRun) {
      logger.info(`🔍 DRY RUN: Would upload to S3 bucket: ${s3Bucket}`);
      logger.info(`🔍 DRY RUN: Property would be available at: https://${s3Bucket}.s3.${awsRegion}.amazonaws.com/homes/${propertyId}/`);
    } else {
      // Upload to S3
      await uploadToS3(deployDir, propertyId, s3Bucket, awsRegion, logger);
    }

    // Clean up
    if (url && sourceDir) {
      await fs.remove(sourceDir);
    }
    await fs.remove(deployDir);
    logger.info(`🧹 Cleaned up temporary files`);

  } catch (error) {
    logger.error(`❌ Deployment failed: ${error.message}`);
    throw error;
  }

  logger.finalize();
}

async function copyAndFlatten(sourceDir, deployDir, logger) {
  // Check if source has a nested homes/public structure
  const nestedHomesPath = path.join(sourceDir, 'homes');
  if (await fs.pathExists(nestedHomesPath)) {
    logger.info(`🔄 Found nested homes structure, flattening...`);
    
    // Find the actual content (could be in homes/public or just homes)
    const publicPath = path.join(nestedHomesPath, 'public');
    const contentPath = await fs.pathExists(publicPath) ? publicPath : nestedHomesPath;
    
    // Copy all files from the nested structure to the root
    const files = await getAllFiles(contentPath);
    for (const file of files) {
      const relativePath = path.relative(contentPath, file);
      const targetPath = path.join(deployDir, relativePath);
      
      // Ensure target directory exists
      await fs.ensureDir(path.dirname(targetPath));
      
      // Copy the file
      await fs.copy(file, targetPath);
    }
    
    logger.info(`✅ Flattened structure successfully`);
  } else {
    // No nested structure, copy normally
    await fs.copy(sourceDir, deployDir);
  }
}

async function downloadFromIPFS(url, logger) {
  const tempDir = path.join(process.cwd(), 'ipfs-download-temp');
  await fs.ensureDir(tempDir);

  const cid = extractCidFromUrl(url);
  if (!cid) {
    throw new Error('Could not extract CID from URL');
  }

  logger.info(`📥 Downloading from IPFS CID: ${cid}`);

  // Use faster, more reliable gateways first
  const gateways = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/'
  ];

  // Try gateways in parallel with shorter timeouts
  const downloadPromises = gateways.map(async (gateway) => {
    try {
      logger.info(`🔄 Trying gateway: ${gateway}`);
      
      const downloadUrl = `${gateway}${cid}`;
      const downloadedFile = path.join(tempDir, `downloaded-content-${gateway.replace(/[^a-zA-Z0-9]/g, '')}`);
      
      // Download with shorter timeout and fewer retries, show progress
      const { stdout, stderr } = await execAsync(
        `curl -L -o "${downloadedFile}" --max-time 15 --retry 1 --retry-delay 1 --progress-bar "${downloadUrl}"`
      );

      // Check if it's HTML
      const fileContent = await fs.readFile(downloadedFile, 'utf8');
      
      if (fileContent.trim().startsWith('<!DOCTYPE html') || fileContent.trim().startsWith('<html')) {
        logger.info(`✅ Downloaded HTML from ${gateway}`);
        
        // Create the deployment structure
        const deployDir = path.join(tempDir, 'deploy');
        await fs.ensureDir(deployDir);
        
        // Write the HTML file
        await fs.writeFile(path.join(deployDir, 'index.html'), fileContent);
        
        // Copy local assets instead of downloading from IPFS
        await copyLocalAssets(deployDir, logger);
        
        return deployDir;
      } else {
        // Try to extract as tar.gz
        try {
          await execAsync(`cd "${tempDir}" && tar -xzf "${downloadedFile}"`);
          logger.info(`✅ Extracted content from ${gateway}`);
          
          // Flatten the structure if it contains nested homes/public directories
          await flattenStructure(tempDir, logger);
          
          return tempDir;
        } catch (extractError) {
          logger.warn(`⚠️  Could not extract from ${gateway}: ${extractError.message}`);
          return null;
        }
      }
    } catch (error) {
      logger.warn(`⚠️  Failed to download from ${gateway}: ${error.message}`);
      return null;
    }
  });

  // Wait for first successful download
  const results = await Promise.allSettled(downloadPromises);
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
  }

  throw new Error('Failed to download from all IPFS gateways');
}

function extractCidFromUrl(url) {
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (match) {
    return match[1];
  }
  throw new Error('Could not extract CID from URL');
}

async function flattenStructure(tempDir, logger) {
  // Check if there's a nested homes structure (IPFS doesn't have public)
  const nestedHomesPath = path.join(tempDir, 'homes');
  if (await fs.pathExists(nestedHomesPath)) {
    logger.info(`🔄 Flattening nested homes structure...`);
    
    // Move all files from the nested homes directory to the root
    const files = await getAllFiles(nestedHomesPath);
    for (const file of files) {
      const relativePath = path.relative(nestedHomesPath, file);
      const targetPath = path.join(tempDir, relativePath);
      
      // Ensure target directory exists
      await fs.ensureDir(path.dirname(targetPath));
      
      // Move the file
      await fs.move(file, targetPath);
    }
    
    // Remove the nested homes directory
    await fs.remove(nestedHomesPath);
    
    logger.info(`✅ Flattened structure successfully`);
  }
}

async function copyLocalAssets(deployDir, logger) {
  // Copy assets directly to deploy directory root (not in a subdirectory)
  const templatesPath = path.join(process.cwd(), 'templates', 'assets');
  
  if (await fs.pathExists(templatesPath)) {
    logger.info(`📁 Copying local assets from templates...`);
    
    // Copy CSS files
    const cssSource = path.join(templatesPath, 'css');
    if (await fs.pathExists(cssSource)) {
      const cssTarget = path.join(deployDir, 'css');
      await fs.ensureDir(cssTarget);
      await fs.copy(cssSource, cssTarget);
      logger.info(`✅ Copied CSS assets`);
    }
    
    // Copy JS files
    const jsSource = path.join(templatesPath, 'js');
    if (await fs.pathExists(jsSource)) {
      const jsTarget = path.join(deployDir, 'js');
      await fs.ensureDir(jsTarget);
      await fs.copy(jsSource, jsTarget);
      logger.info(`✅ Copied JS assets`);
    }
    
    // Copy static assets (images, icons, etc.)
    const staticSource = path.join(templatesPath, 'static');
    if (await fs.pathExists(staticSource)) {
      const files = await fs.readdir(staticSource);
      for (const file of files) {
        const sourcePath = path.join(staticSource, file);
        const targetPath = path.join(deployDir, file);
        await fs.copy(sourcePath, targetPath);
      }
      logger.info(`✅ Copied ${files.length} static assets`);
    }
  } else {
    logger.warn(`⚠️  Templates directory not found, assets may be missing`);
  }
}

async function fixAssetPaths(deployDir, logger) {
  // Find all HTML files
  const htmlFiles = await findHtmlFiles(deployDir);
  
  for (const htmlFile of htmlFiles) {
    let html = await fs.readFile(htmlFile, 'utf8');
    
    // Keep relative paths as-is since assets are in the same directory as HTML
    // The HTML files will work with relative paths like ./css/style.css, ./images/icon.svg
    // No need to convert to absolute S3 URLs since everything is under the same property directory
    
    await fs.writeFile(htmlFile, html);
  }
  
  logger.info(`✅ Fixed asset paths for S3`);
}

async function findHtmlFiles(dir) {
  const files = [];
  const items = await fs.readdir(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      files.push(...await findHtmlFiles(fullPath));
    } else if (item.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function uploadToS3(deployDir, propertyId, bucket, region, logger) {
  logger.info(`📤 Uploading to S3 bucket: ${bucket}`);
  
  // Upload HTML files to property-specific directory
  const htmlFiles = await findHtmlFiles(deployDir);
  for (const htmlFile of htmlFiles) {
    const relativePath = path.relative(deployDir, htmlFile);
    const s3Key = `homes/${propertyId}/${relativePath}`;
    
    const uploadCommand = `aws s3 cp "${htmlFile}" "s3://${bucket}/${s3Key}" --content-type "text/html"`;
    await execAsync(uploadCommand);
    logger.info(`✅ Uploaded: ${s3Key}`);
  }
  
  // Upload ALL assets - scan the entire deployment directory
  logger.info(`🔍 Scanning for assets in deployment directory...`);
  const allFiles = await getAllFiles(deployDir);
  const assetFiles = allFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.ico', '.webp', '.avif', '.woff', '.woff2', '.ttf', '.eot'].includes(ext);
  });
  
  logger.info(`📦 Found ${assetFiles.length} asset files to upload`);
  
  for (const assetFile of assetFiles) {
    const relativePath = path.relative(deployDir, assetFile);
    // Upload assets to property-specific directory
    const s3Key = `homes/${propertyId}/${relativePath}`;
    
    // Determine content type based on file extension
    const ext = path.extname(assetFile).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.ico') contentType = 'image/x-icon';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.avif') contentType = 'image/avif';
    else if (ext === '.woff') contentType = 'font/woff';
    else if (ext === '.woff2') contentType = 'font/woff2';
    else if (ext === '.ttf') contentType = 'font/ttf';
    else if (ext === '.eot') contentType = 'application/vnd.ms-fontobject';
    
    const uploadCommand = `aws s3 cp "${assetFile}" "s3://${bucket}/${s3Key}" --content-type "${contentType}"`;
    await execAsync(uploadCommand);
    logger.info(`✅ Uploaded asset: ${s3Key}`);
  }
  
  logger.info(`✅ Successfully deployed to S3`);
  logger.info(`🌐 Your property is now live at: https://${bucket}.s3.${region}.amazonaws.com/homes/${propertyId}/`);
}

async function getAllFiles(dir) {
  const files = [];
  const items = await fs.readdir(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      files.push(...await getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Parse CSV file
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim().replace(/"/g, '') || '';
    });
    data.push(row);
  }
  
  return data;
}

// Extract property ID from filePath
function extractPropertyId(filePath) {
  if (filePath) {
    // Extract the property ID from the file path
    // Example: "/content/submit-photo/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa/bafkreih226p5vjhx33jwgq7trblyplfw7yhkununuuahgpfok3hnh5mjwq.json"
    // We want: bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa
    const pathParts = filePath.split('/');
    // Find the property ID (it's the second to last part before the filename)
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (pathParts[i] === 'submit-photo' && pathParts[i + 1]) {
        return pathParts[i + 1];
      }
    }
  }
  
  return null;
}

async function deployFromCSV(options) {
  const { 
    csvFile, 
    logFile = 'deploy-s3-csv.log', 
    verbose = false, 
    quiet = false, 
    dryRun = false 
  } = options;

  // Load environment variables
  loadEnv();

  // Get Logger class and create logger
  const Logger = await getLogger();
  const logger = new Logger({
    quiet: quiet,
    verbose: verbose,
    logFile: logFile
  });

  logger.info(`📋 Processing CSV file: ${csvFile}`);

  // Validate environment variables
  const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION', 'S3_BUCKET'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`${envVar} environment variable is required`);
      logger.finalize();
      process.exit(1);
    }
  }

  try {
    // Check if CSV file exists
    if (!fs.existsSync(csvFile)) {
      logger.error(`❌ CSV file not found: ${csvFile}`);
      process.exit(1);
    }

    // Read and parse CSV file
    const csvContent = fs.readFileSync(csvFile, 'utf8');
    const data = parseCSV(csvContent);
    
    logger.info(`📋 Found ${data.length} entries to deploy from ${path.basename(csvFile)}`);

    // Process each entry
    for (const row of data) {
      const propertyId = extractPropertyId(row.filePath);
      const htmlLink = row.htmlLink;
      
      if (!propertyId) {
        logger.warn(`⚠️  Could not extract property ID from filePath: ${row.filePath}`);
        continue;
      }
      
      if (!htmlLink) {
        logger.warn(`⚠️  No HTML link found for property: ${propertyId}`);
        continue;
      }
      
      logger.info(`\n📦 Processing: Property ${propertyId} (filePath: ${row.filePath}) -> ${htmlLink}`);
      
      // Deploy this property
      await deployToS3({
        propertyId: propertyId,
        url: htmlLink,
        logFile: logFile,
        verbose: verbose,
        quiet: quiet,
        dryRun: dryRun
      });
    }
    
    logger.success(`\n🎉 CSV deployment process completed!`);
    
  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }

  logger.finalize();
}

program.parse(); 