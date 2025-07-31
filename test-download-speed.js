#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testDownloadSpeed() {
  console.log('🚀 Testing download speed improvements...\n');
  
  const testUrl = 'https://ipfs.io/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa';
  
  console.log('📊 Testing different download approaches:');
  
  // Test 1: Single gateway with long timeout
  console.log('\n1️⃣ Testing single gateway (old method):');
  const start1 = Date.now();
  try {
    await execAsync(`curl -L --max-time 30 --retry 3 --retry-delay 2 --silent "${testUrl}" > /dev/null`);
    const time1 = Date.now() - start1;
    console.log(`   ⏱️  Time: ${time1}ms`);
  } catch (error) {
    console.log('   ❌ Failed');
  }
  
  // Test 2: Multiple gateways in parallel (new method)
  console.log('\n2️⃣ Testing parallel gateways (new method):');
  const start2 = Date.now();
  try {
    const gateways = [
      'https://cloudflare-ipfs.com/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa',
      'https://ipfs.io/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa',
      'https://gateway.pinata.cloud/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa'
    ];
    
    const promises = gateways.map(url => 
      execAsync(`curl -L --max-time 15 --retry 1 --retry-delay 1 --silent "${url}" > /dev/null`)
    );
    
    await Promise.any(promises);
    const time2 = Date.now() - start2;
    console.log(`   ⏱️  Time: ${time2}ms`);
    console.log(`   🎯 Speed improvement: ${Math.round((time1 - time2) / time1 * 100)}% faster`);
  } catch (error) {
    console.log('   ❌ Failed');
  }
  
  console.log('\n✅ Speed test completed!');
  console.log('\n💡 The new parallel download method should be significantly faster.');
}

testDownloadSpeed(); 