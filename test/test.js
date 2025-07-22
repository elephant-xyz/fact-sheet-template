#!/usr/bin/env node

import { Builder } from '../lib/builder.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
  console.log('🧪 Running tests...\n');
  
  const testDir = path.join(__dirname, 'test-data');
  const outputDir = path.join(__dirname, 'test-output');
  
  try {
    // Clean up previous test runs
    await fs.remove(outputDir);
    await fs.remove(testDir);
    
    // Create test data
    console.log('📁 Creating test data...');
    await fs.ensureDir(path.join(testDir, 'test-property-1'));
    await fs.ensureDir(path.join(testDir, 'test-property-2'));
    
    // Property 1 data
    await fs.writeJson(path.join(testDir, 'test-property-1', 'address.json'), {
      full_address: '123 Test Street, Test City, TC 12345',
      street_number: '123',
      street_name: 'Test Street',
      city_name: 'Test City',
      state_code: 'TC',
      postal_code: '12345',
      county_name: 'Test County',
      latitude: 40.7128,
      longitude: -74.0060
    });
    
    await fs.writeJson(path.join(testDir, 'test-property-1', 'building.json'), {
      bedrooms: 3,
      bathrooms: 2,
      total_sqft: 1500,
      property_type: 'Single Family Home'
    });
    
    await fs.writeJson(path.join(testDir, 'test-property-1', 'sales_1.json'), {
      sales_transaction_amount: 450000,
      sales_date: '2023-06-15'
    });
    
    await fs.writeJson(path.join(testDir, 'test-property-1', 'tax_1.json'), {
      tax_year: 2023,
      property_assessed_value_amount: 425000,
      property_market_value_amount: 450000
    });
    
    // Property 2 data (minimal)
    await fs.writeJson(path.join(testDir, 'test-property-2', 'address.json'), {
      full_address: '456 Another St, Other City, OC 67890'
    });
    
    console.log('✅ Test data created\n');
    
    // Test 1: Basic build
    console.log('🧪 Test 1: Basic build...');
    const builder1 = new Builder({
      input: testDir,
      output: path.join(outputDir, 'basic'),
      domain: 'https://test.example.com',
      verbose: false
    });
    
    await builder1.build();
    
    // Verify output
    const basicOutput = path.join(outputDir, 'basic');
    const prop1Dir = path.join(basicOutput, 'test-property-1');
    const prop2Dir = path.join(basicOutput, 'test-property-2');
    
    if (!await fs.pathExists(path.join(prop1Dir, 'index.html'))) {
      throw new Error('Property 1 HTML not generated');
    }
    
    if (!await fs.pathExists(path.join(prop1Dir, 'css', 'root_style.css'))) {
      throw new Error('Property 1 CSS not copied');
    }
    
    if (!await fs.pathExists(path.join(prop1Dir, 'manifest.json'))) {
      throw new Error('Property 1 manifest not generated');
    }
    
    if (!await fs.pathExists(path.join(prop2Dir, 'index.html'))) {
      throw new Error('Property 2 HTML not generated');
    }
    
    console.log('✅ Basic build test passed\n');
    
    // Test 2: Inline build
    console.log('🧪 Test 2: Inline build...');
    const builder2 = new Builder({
      input: testDir,
      output: path.join(outputDir, 'inline'),
      domain: 'https://test.example.com',
      inlineCss: true,
      inlineJs: true,
      verbose: false
    });
    
    await builder2.build();
    
    // Verify inline output
    const inlineOutput = path.join(outputDir, 'inline');
    const inlineProp1Dir = path.join(inlineOutput, 'test-property-1');
    
    if (!await fs.pathExists(path.join(inlineProp1Dir, 'index.html'))) {
      throw new Error('Inline property 1 HTML not generated');
    }
    
    // Should NOT have separate CSS/JS files
    if (await fs.pathExists(path.join(inlineProp1Dir, 'css'))) {
      throw new Error('CSS directory should not exist in inline build');
    }
    
    if (await fs.pathExists(path.join(inlineProp1Dir, 'js'))) {
      throw new Error('JS directory should not exist in inline build');
    }
    
    // Check that HTML file is larger (contains inlined assets)
    const basicHtml = await fs.readFile(path.join(prop1Dir, 'index.html'), 'utf8');
    const inlineHtml = await fs.readFile(path.join(inlineProp1Dir, 'index.html'), 'utf8');
    
    if (inlineHtml.length <= basicHtml.length) {
      throw new Error('Inline HTML should be larger than basic HTML');
    }
    
    if (!inlineHtml.includes('<style>')) {
      throw new Error('Inline HTML should contain <style> tags');
    }
    
    console.log('✅ Inline build test passed\n');
    
    // Test 3: Verify HTML content
    console.log('🧪 Test 3: HTML content verification...');
    
    if (!basicHtml.includes('123 Test Street')) {
      throw new Error('HTML should contain property address');
    }
    
    if (!basicHtml.includes('3')) { // bedrooms
      throw new Error('HTML should contain bedroom count');
    }
    
    if (!basicHtml.includes('$450,000')) {
      throw new Error('HTML should contain formatted sale price');
    }
    
    console.log('✅ HTML content test passed\n');
    
    // Clean up
    await fs.remove(testDir);
    await fs.remove(outputDir);
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}