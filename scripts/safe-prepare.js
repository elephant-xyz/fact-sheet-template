#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

// Check if dist folder already exists (from git)
const hasDistFolder = fs.existsSync('dist');

if (hasDistFolder) {
  console.log('✓ Using pre-built dist folder from repository');
  process.exit(0);
}

// Check if we can build
const hasTypeScript = fs.existsSync('node_modules/typescript/bin/tsc');

if (!hasTypeScript) {
  console.warn('⚠️  TypeScript not found and dist/ folder missing.');
  console.warn('⚠️  Cannot build the package. Please either:');
  console.warn('    1. Install from npm registry: npm install @elephant-xyz/fact-sheet');
  console.warn('    2. Clone and build manually with devDependencies');
  process.exit(0); // Exit gracefully to not break installation
}

// Build the project
try {
  console.log('Building TypeScript files...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✓ Build completed successfully');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}