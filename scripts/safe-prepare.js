#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

// Check if we're in a git install context without devDependencies
const hasTypeScript = fs.existsSync('node_modules/typescript/bin/tsc');
const hasDistFolder = fs.existsSync('dist');

if (!hasTypeScript && !hasDistFolder) {
  console.warn('⚠️  TypeScript not found and dist/ folder missing.');
  console.warn('⚠️  This package requires building from source.');
  console.warn('⚠️  Please install from npm registry or clone and build manually:');
  console.warn('    git clone https://github.com/elephant-xyz/fact-sheet-template.git');
  console.warn('    cd fact-sheet-template');
  console.warn('    npm install');
  console.warn('    npm run build');
  console.warn('    npm link');
  process.exit(0); // Exit gracefully to not break installation
}

if (hasTypeScript) {
  try {
    console.log('Building TypeScript files...');
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
} else if (hasDistFolder) {
  console.log('Using pre-built dist folder');
}