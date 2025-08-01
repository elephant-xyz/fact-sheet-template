#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
        results.push({ directory: dir, success: true, htmlFiles });
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
  });
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(result => {
      console.log(`  - ${result.directory}: ${result.error}`);
    });
  }
  
  console.log('');
  console.log(`📁 Test output location: ${outputDir}`);
  console.log(`🎯 Overall success rate: ${Math.round((successful.length / results.length) * 100)}%`);
  
  return results;
}

// Run the test
testGenerateAll().catch(console.error); 