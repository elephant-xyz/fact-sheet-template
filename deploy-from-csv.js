#!/usr/bin/env node

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

// Extract property ID from filePath
function extractPropertyId(filePath) {
  // Extract property ID from path like "/content/output/52434205310037080/..."
  const match = filePath.match(/\/content\/output\/(\d+)\//);
  return match ? match[1] : null;
}

// Run deployment command
async function deployProperty(propertyId, htmlLink) {
  const command = `NETLIFY_SITE_ID=288e2702-f7ef-46f1-8c9d-2f2e5d763b14 NETLIFY_TOKEN=nfp_AuZhFgVjYhCzeDobd32NcmVW3RoFscyP98a0 node ~/.elephant-fact-sheet/bin/deploy-production.js deploy -p ${propertyId} -u "${htmlLink}" --verbose`;
  
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
    // Read CSV file
    const csvPath = '.elephant-dev/data/upload-results (3).csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV
    const data = parseCSV(csvContent);
    console.log(`📋 Found ${data.length} entries to deploy`);
    
    // Process each entry
    for (const row of data) {
      const propertyId = extractPropertyId(row.filePath);
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