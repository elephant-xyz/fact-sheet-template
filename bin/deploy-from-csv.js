#!/usr/bin/env node

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { Logger } from '../dist/lib/logger.js';

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

// Initialize logger
const logger = new Logger({
  quiet: false,
  verbose: true,
  ci: false,
  logFile: 'deploy-from-csv.log'
});

// Read and parse CSV file
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

// Extract property ID from dataCid
function extractPropertyId(dataCid) {
  if (dataCid) {
    return dataCid;
  }
  
  return null;
}

// Run deployment command
async function deployProperty(propertyId, htmlLink, dryRun = false) {
  const netlifySiteId = process.env.NETLIFY_SITE_ID;
  const netlifyToken = process.env.NETLIFY_TOKEN;
  
  if (!netlifySiteId || !netlifyToken) {
    logger.error('❌ Environment variables NETLIFY_SITE_ID and NETLIFY_TOKEN must be set');
    logger.error('Create a .env file with these variables or set them in your environment');
    process.exit(1);
  }
  
  // Get the directory where this script is located
  const scriptPath = process.argv[1];
  const scriptDir = path.dirname(scriptPath);
  const factSheetDir = path.dirname(scriptDir); // Go up one level from bin/
  const deployScriptPath = path.join(factSheetDir, 'bin', 'deploy-production.js');
  
  logger.info(`🔍 Debug: Script path: ${scriptPath}`);
  logger.info(`🔍 Debug: Script dir: ${scriptDir}`);
  logger.info(`🔍 Debug: Fact sheet dir: ${factSheetDir}`);
  logger.info(`🔍 Debug: Deploy script path: ${deployScriptPath}`);
  
  const dryRunFlag = dryRun ? ' --dry-run' : '';
  const command = `cd "${factSheetDir}" && NETLIFY_SITE_ID=${netlifySiteId} NETLIFY_TOKEN=${netlifyToken} node bin/deploy-production.js deploy -p ${propertyId} -u "${htmlLink}" --verbose${dryRunFlag}`;
  
  if (dryRun) {
    logger.info(`🔍 DRY RUN: Would deploy property ${propertyId} from ${htmlLink}...`);
    logger.info(`🔍 DRY RUN: Command would be: ${command}`);
  } else {
    logger.info(`🚀 Deploying property ${propertyId} from ${htmlLink}...`);
  }
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (dryRun) {
      logger.success(`✅ DRY RUN: Successfully simulated deployment for property ${propertyId}`);
    } else {
      logger.success(`✅ Successfully deployed property ${propertyId}`);
    }
    if (stdout) logger.info(stdout);
    if (stderr) logger.warn(stderr);
  } catch (error) {
    logger.error(`❌ Failed to deploy property ${propertyId}: ${error.message}`);
  }
}

// Main function
async function main() {
  try {
    // Load environment variables
    loadEnv();
    
    // Get CSV filename from command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
      logger.error('❌ Usage: node bin/deploy-from-csv.js <csv-file-path> [--dry-run]');
      logger.error('Example: node bin/deploy-from-csv.js "/content/upload-results.csv"');
      logger.error('Example: node bin/deploy-from-csv.js "./data/upload-results.csv" --dry-run');
      logger.error('');
      logger.error('Note: Must be run from the fact-sheet-template directory');
      logger.error('CSV should have columns: dataCid, htmlLink');
      logger.error('Environment variables (can be set in .env file):');
      logger.error('  NETLIFY_SITE_ID - Your Netlify site ID');
      logger.error('  NETLIFY_TOKEN - Your Netlify token');
      process.exit(1);
    }
    
    // Check for dry-run flag
    const dryRun = args.includes('--dry-run');
    const csvPath = args.find(arg => !arg.startsWith('--'));
    
    if (!csvPath) {
      logger.error('❌ CSV file path is required');
      process.exit(1);
    }
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      logger.error(`❌ CSV file not found: ${csvPath}`);
      logger.error(`Please provide the full path to your CSV file`);
      process.exit(1);
    }
    
    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV
    const data = parseCSV(csvContent);
    logger.info(`📋 Found ${data.length} entries to deploy from ${path.basename(csvPath)}`);
    
    // Process each entry
    for (const row of data) {
      const propertyId = extractPropertyId(row.dataCid);
      const htmlLink = row.htmlLink;
      
      if (!propertyId) {
        logger.warn(`⚠️  Could not extract property ID from dataCid: ${row.dataCid}`);
        continue;
      }
      
      if (!htmlLink) {
        logger.warn(`⚠️  No HTML link found for property: ${propertyId}`);
        continue;
      }
      
      logger.info(`\n📦 Processing: Property ${propertyId} (dataCid: ${row.dataCid}) -> ${htmlLink}`);
      await deployProperty(propertyId, htmlLink, dryRun);
    }
    
    logger.success(`\n🎉 Deployment process completed!`);
    
  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main(); 