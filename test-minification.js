#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

console.log('Testing minification implementation...\n');

const testDir = './test-minification-output';
const exampleData = './example-data/county';

// Clean up test directory
if (fs.existsSync(testDir)) {
  fs.removeSync(testDir);
}

// First, build the project
console.log('Building project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

// Test 1: Generate without minification
console.log('\n1. Generating without minification...');
try {
  execSync(`node bin/fact-sheet.js generate -i ${exampleData} -o ${testDir}/normal --quiet`, { stdio: 'inherit' });
} catch (error) {
  console.error('Generation without minification failed:', error.message);
  process.exit(1);
}

// Test 2: Generate with minification
console.log('\n2. Generating with minification...');
try {
  execSync(`node bin/fact-sheet.js generate -i ${exampleData} -o ${testDir}/minified --minify --quiet`, { stdio: 'inherit' });
} catch (error) {
  console.error('Generation with minification failed:', error.message);
  process.exit(1);
}

// Test 3: Generate with minification and inline CSS/JS
console.log('\n3. Generating with minification and inline CSS/JS...');
try {
  execSync(`node bin/fact-sheet.js generate -i ${exampleData} -o ${testDir}/minified-inline --minify --inline-css --inline-js --quiet`, { stdio: 'inherit' });
} catch (error) {
  console.error('Generation with minification and inline failed:', error.message);
  process.exit(1);
}

// Compare file sizes
console.log('\n4. Comparing file sizes...\n');

function getDirectorySize(dir) {
  let totalSize = 0;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += fs.statSync(filePath).size;
    }
  }
  
  return totalSize;
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

// Get first property directory
const properties = fs.readdirSync(path.join(testDir, 'normal'));
const firstProperty = properties[0];

if (firstProperty) {
  const normalSize = getDirectorySize(path.join(testDir, 'normal', firstProperty));
  const minifiedSize = getDirectorySize(path.join(testDir, 'minified', firstProperty));
  const minifiedInlineSize = getDirectorySize(path.join(testDir, 'minified-inline', firstProperty));
  
  console.log(`Property: ${firstProperty}`);
  console.log(`Normal:           ${formatBytes(normalSize)}`);
  console.log(`Minified:         ${formatBytes(minifiedSize)} (${((1 - minifiedSize/normalSize) * 100).toFixed(1)}% reduction)`);
  console.log(`Minified+Inline:  ${formatBytes(minifiedInlineSize)} (${((1 - minifiedInlineSize/normalSize) * 100).toFixed(1)}% reduction)`);
  
  // Check specific files
  const indexNormal = fs.statSync(path.join(testDir, 'normal', firstProperty, 'index.html')).size;
  const indexMinified = fs.statSync(path.join(testDir, 'minified', firstProperty, 'index.html')).size;
  
  console.log(`\nindex.html:`);
  console.log(`Normal:   ${formatBytes(indexNormal)}`);
  console.log(`Minified: ${formatBytes(indexMinified)} (${((1 - indexMinified/indexNormal) * 100).toFixed(1)}% reduction)`);
}

console.log('\n✅ Minification tests completed successfully!');
console.log(`\nTest output saved to: ${path.resolve(testDir)}`);