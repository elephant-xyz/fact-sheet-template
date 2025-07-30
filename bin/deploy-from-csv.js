#!/usr/bin/env node

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

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

// Extract property ID from filePath or propertyCid
function extractPropertyId(filePath, propertyCid) {
  // First try to extract from filePath like "/content/output/52434205310037080/..."
  const match = filePath.match(/\/content\/output\/(\d+)\//);
  if (match) {
    return match[1];
  }
  
  // If that fails, use the propertyCid as the property ID
  if (propertyCid) {
    return propertyCid;
  }
  
  return null;
}

// Run deployment command
async function deployProperty(propertyId, htmlLink) {
  const netlifySiteId = process.env.NETLIFY_SITE_ID;
  const netlifyToken = process.env.NETLIFY_TOKEN;
  
  if (!netlifySiteId || !netlifyToken) {
    console.error('❌ Environment variables NETLIFY_SITE_ID and NETLIFY_TOKEN must be set');
    console.error('Create a .env file with these variables or set them in your environment');
    process.exit(1);
  }
  
  const command = `NETLIFY_SITE_ID=${netlifySiteId} NETLIFY_TOKEN=${netlifyToken} node bin/deploy-production.js deploy -p ${propertyId} -u "${htmlLink}" --verbose`;
  
  console.log(`🚀 Deploying property ${propertyId} from ${htmlLink}...`);
  
  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`✅ Successfully deployed property ${propertyId}`);
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
  } catch (error) {
    console.error(`❌ Failed to deploy property ${propertyId}:`, error.message);
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
      console.error('❌ Usage: node bin/deploy-from-csv.js <csv-filename>');
      console.error('Example: node bin/deploy-from-csv.js "upload-results (3).csv"');
      console.error('');
      console.error('Environment variables (can be set in .env file):');
      console.error('  NETLIFY_SITE_ID - Your Netlify site ID');
      console.error('  NETLIFY_TOKEN - Your Netlify token');
      process.exit(1);
    }
    
    const csvFilename = args[0];
    const csvPath = path.join('.elephant-dev/data', csvFilename);
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found: ${csvPath}`);
      process.exit(1);
    }
    
    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV
    const data = parseCSV(csvContent);
    console.log(`📋 Found ${data.length} entries to deploy from ${csvFilename}`);
    
    // Process each entry
    for (const row of data) {
      const propertyId = extractPropertyId(row.filePath, row.propertyCid);
      const htmlLink = row.htmlLink;
      
      if (!propertyId) {
        console.warn(`⚠️  Could not extract property ID from: ${row.filePath}`);
        continue;
      }
      
      if (!htmlLink) {
        console.warn(`⚠️  No HTML link found for property: ${propertyId}`);
        continue;
      }
      
      console.log(`\n📦 Processing: Property ${propertyId} -> ${htmlLink}`);
      await deployProperty(propertyId, htmlLink);
    }
    
    console.log(`\n🎉 Deployment process completed!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main(); 