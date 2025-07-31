#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

async function testDeployment() {
  console.log('🧪 Testing S3 deployment functionality...');
  
  try {
    // Check if AWS CLI is installed
    try {
      await execAsync('aws --version');
      console.log('✅ AWS CLI is installed');
    } catch (error) {
      console.error('❌ AWS CLI is not installed. Please install it first.');
      process.exit(1);
    }
    
    // Check if environment variables are set
    const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION', 'S3_BUCKET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
      console.error('Please set these variables in your .env file or environment');
      process.exit(1);
    }
    
    console.log('✅ All required environment variables are set');
    
    // Test with a sample property
    const testPropertyId = 'test-property-123';
    const testUrl = 'https://ipfs.io/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa';
    
    console.log(`\n🚀 Testing deployment with property ID: ${testPropertyId}`);
    console.log(`📥 Downloading from: ${testUrl}`);
    
    // Run the deployment with dry-run flag
    const deployCommand = `node bin/deploy-to-s3.js deploy -p ${testPropertyId} -u ${testUrl} --dry-run --verbose`;
    
    console.log(`\n📋 Running: ${deployCommand}`);
    
    const { stdout, stderr } = await execAsync(deployCommand);
    
    console.log('\n📤 Deployment test output:');
    console.log(stdout);
    
    if (stderr) {
      console.log('\n⚠️  Warnings/Errors:');
      console.log(stderr);
    }
    
    console.log('\n✅ Deployment test completed successfully!');
    console.log('\n📝 To deploy for real (without --dry-run), run:');
    console.log(`node bin/deploy-to-s3.js deploy -p ${testPropertyId} -u ${testUrl} --verbose`);
    
  } catch (error) {
    console.error('❌ Deployment test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testDeployment(); 