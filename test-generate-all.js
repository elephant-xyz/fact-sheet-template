#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Function to validate county links in generated HTML
async function validateCountyLinks(outputPath, htmlFiles) {
  console.log('  🔗 Validating county links...');
  
  const countyLinkResults = [];
  
  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(outputPath, htmlFile);
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    
    // Check if county link exists
    const hasCountyLink = htmlContent.includes('countysrc') && htmlContent.includes('View County Data Source');
    
    if (!hasCountyLink) {
      console.log(`    ⚠️  No county link found in ${htmlFile}`);
      countyLinkResults.push({ file: htmlFile, success: false, error: 'No county link found' });
      continue;
    }
    
    // Extract county link URL
    const countyLinkMatch = htmlContent.match(/href="([^"]*)"[^>]*>View County Data Source/);
    
    if (!countyLinkMatch) {
      console.log(`    ⚠️  County link URL not found in ${htmlFile}`);
      countyLinkResults.push({ file: htmlFile, success: false, error: 'County link URL not found' });
      continue;
    }
    
    const countyUrl = countyLinkMatch[1];
    console.log(`    📍 Found county link: ${countyUrl}`);
    
    // Validate URL format based on county
    let isValidUrl = false;
    let expectedPattern = '';
    
    if (countyUrl.includes('leepa.org')) {
      // Lee County Property Appraiser
      isValidUrl = countyUrl.includes('DisplayParcel.aspx') && countyUrl.includes('FolioID=');
      expectedPattern = 'https://www.leepa.org/Display/DisplayParcel.aspx?FolioID=';
    } else if (countyUrl.includes('pbcpao.gov')) {
      // Palm Beach County Property Appraiser
      isValidUrl = countyUrl.includes('Property/Details') && countyUrl.includes('parcelId=');
      expectedPattern = 'https://pbcpao.gov/Property/Details?parcelId=';
    } else {
      console.log(`    ⚠️  Unknown county URL format: ${countyUrl}`);
      countyLinkResults.push({ file: htmlFile, success: false, error: `Unknown county URL format: ${countyUrl}` });
      continue;
    }
    
    if (!isValidUrl) {
      console.log(`    ❌ Invalid county URL format: ${countyUrl}`);
      console.log(`    📋 Expected pattern: ${expectedPattern}`);
      countyLinkResults.push({ file: htmlFile, success: false, error: `Invalid URL format: ${countyUrl}` });
      continue;
    }
    
    // Check if URL has a valid parameter value
    const hasParameter = countyUrl.includes('=') && countyUrl.split('=')[1] && countyUrl.split('=')[1].length > 0;
    
    if (!hasParameter) {
      console.log(`    ❌ County URL missing parameter value: ${countyUrl}`);
      countyLinkResults.push({ file: htmlFile, success: false, error: `Missing parameter value: ${countyUrl}` });
      continue;
    }
    
    console.log(`    ✅ Valid county link: ${countyUrl}`);
    countyLinkResults.push({ file: htmlFile, success: true, url: countyUrl });
  }
  
  const validLinks = countyLinkResults.filter(r => r.success);
  const invalidLinks = countyLinkResults.filter(r => !r.success);
  
  console.log(`    📊 County link validation: ${validLinks.length} valid, ${invalidLinks.length} invalid`);
  
  return {
    total: countyLinkResults.length,
    valid: validLinks.length,
    invalid: invalidLinks.length,
    results: countyLinkResults
  };
}

async function testGenerateAll() {
  console.log('🧪 Testing HTML generation for all example-data folders...\n');
  
  const exampleDataDir = './example-data';
  const outputDir = './test-output';
  
  // Clean up previous test output
  if (await fs.pathExists(outputDir)) {
    await fs.remove(outputDir);
  }
  
  // Get all subdirectories in example-data
  const items = await fs.readdir(exampleDataDir);
  const directories = [];
  
  for (const item of items) {
    const itemPath = path.join(exampleDataDir, item);
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      directories.push(item);
    }
  }
  
  console.log(`📁 Found ${directories.length} directories in example-data:`);
  directories.forEach(dir => console.log(`  - ${dir}`));
  console.log('');
  
  const results = [];
  
  // Test each directory
  for (const dir of directories) {
    console.log(`🔍 Testing: ${dir}`);
    
    const inputPath = path.join(exampleDataDir, dir);
    const outputPath = path.join(outputDir, dir);
    
    try {
      // Run the fact-sheet generation command
      const command = `node bin/fact-sheet.js generate --input ${inputPath} --output ${outputPath} --verbose`;
      console.log(`  Running: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      
      // Check if output directory was created
      const outputExists = await fs.pathExists(outputPath);
      
      if (!outputExists) {
        console.log(`  ❌ Output directory not created: ${outputPath}`);
        results.push({ directory: dir, success: false, error: 'Output directory not created' });
        continue;
      }
      
      // Check for generated HTML files (fact-sheet creates subdirectories for each property)
      const files = await fs.readdir(outputPath);
      const subdirs = [];
      const htmlFiles = [];
      
      // Look for subdirectories (property CIDs) and check for index.html inside them
      for (const file of files) {
        const filePath = path.join(outputPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          subdirs.push(file);
          const subdirPath = path.join(outputPath, file);
          const subdirFiles = await fs.readdir(subdirPath);
          const subdirHtmlFiles = subdirFiles.filter(f => f.endsWith('.html') || f === 'index.html');
          htmlFiles.push(...subdirHtmlFiles.map(f => `${file}/${f}`));
        } else if (file.endsWith('.html') || file === 'index.html') {
          htmlFiles.push(file);
        }
      }
      
      if (htmlFiles.length === 0) {
        console.log(`  ❌ No HTML files found in output`);
        results.push({ directory: dir, success: false, error: 'No HTML files generated' });
        continue;
      }
      
      console.log(`  ✅ Generated ${htmlFiles.length} HTML file(s): ${htmlFiles.join(', ')}`);
      
      // Validate HTML content
      let htmlValidation = true;
      for (const htmlFile of htmlFiles) {
        const htmlPath = path.join(outputPath, htmlFile);
        const htmlContent = await fs.readFile(htmlPath, 'utf8');
        
        // Basic HTML validation
        const hasDoctype = htmlContent.includes('<!DOCTYPE html>');
        const hasHtmlTag = htmlContent.includes('<html');
        const hasHeadTag = htmlContent.includes('<head>');
        const hasBodyTag = htmlContent.includes('<body>');
        const hasClosingTags = htmlContent.includes('</html>');
        
        if (!hasDoctype || !hasHtmlTag || !hasHeadTag || !hasBodyTag || !hasClosingTags) {
          console.log(`  ⚠️  HTML validation failed for ${htmlFile}`);
          htmlValidation = false;
        }
        
        // Check for required assets
        const hasCSS = htmlContent.includes('.css') || htmlContent.includes('style');
        const hasJS = htmlContent.includes('.js') || htmlContent.includes('script');
        
        if (!hasCSS) {
          console.log(`  ⚠️  No CSS found in ${htmlFile}`);
        }
        
        // Check file size
        const stats = await fs.stat(htmlPath);
        if (stats.size < 1000) {
          console.log(`  ⚠️  HTML file seems too small: ${stats.size} bytes`);
        }
      }
      
      if (htmlValidation) {
        console.log(`  ✅ HTML validation passed`);
        
        // Validate county links
        const countyLinkValidation = await validateCountyLinks(outputPath, htmlFiles);
        
        results.push({ 
          directory: dir, 
          success: true, 
          htmlFiles,
          countyLinks: countyLinkValidation
        });
      } else {
        results.push({ directory: dir, success: false, error: 'HTML validation failed' });
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ directory: dir, success: false, error: error.message });
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  successful.forEach(result => {
    console.log(`  - ${result.directory}: ${result.htmlFiles.length} HTML file(s)`);
    if (result.countyLinks) {
      console.log(`    County links: ${result.countyLinks.valid}/${result.countyLinks.total} valid`);
    }
  });
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(result => {
      console.log(`  - ${result.directory}: ${result.error}`);
    });
  }
  
  // County link summary
  const allCountyLinks = successful
    .filter(r => r.countyLinks)
    .flatMap(r => r.countyLinks.results);
  
  const validCountyLinks = allCountyLinks.filter(r => r.success);
  const invalidCountyLinks = allCountyLinks.filter(r => !r.success);
  
  if (allCountyLinks.length > 0) {
    console.log(`\n🔗 County Link Summary:`);
    console.log(`  Total county links: ${allCountyLinks.length}`);
    console.log(`  Valid links: ${validCountyLinks.length}`);
    console.log(`  Invalid links: ${invalidCountyLinks.length}`);
    
    if (invalidCountyLinks.length > 0) {
      console.log(`  Invalid link details:`);
      invalidCountyLinks.forEach(link => {
        console.log(`    - ${link.file}: ${link.error}`);
      });
    }
  }
  
  console.log('');
  console.log(`📁 Test output location: ${outputDir}`);
  console.log(`🎯 Overall success rate: ${Math.round((successful.length / results.length) * 100)}%`);
  
  return results;
}

// Run the test
testGenerateAll().catch(console.error); 