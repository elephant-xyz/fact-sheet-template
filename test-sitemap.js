#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';

async function testUpdateSitemap() {
  const deployDir = './deploy-temp';
  const propertyId = '52434205310037080';
  
  console.log('Testing sitemap creation...');
  console.log('Deploy dir:', deployDir);
  console.log('Property ID:', propertyId);
  
  const sitemapPath = path.join(deployDir, 'sitemap.xml');
  let sitemapContent = '';
  
  // Always try to read from production sitemap first
  try {
    console.log('📥 Fetching current sitemap from production...');
    const https = await import('https');
    const productionSitemap = await new Promise((resolve, reject) => {
      https.get('https://elephant.xyz/sitemap.xml', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    console.log('Production sitemap length:', productionSitemap.length);
    console.log('Production sitemap starts with:', productionSitemap.substring(0, 50));
    
    // Check if the response is actually XML (not HTML error page)
    if (productionSitemap.trim().startsWith('<?xml') || productionSitemap.trim().startsWith('<urlset')) {
      sitemapContent = productionSitemap;
      console.log('✅ Successfully fetched production sitemap');
    } else {
      console.log('⚠️  Production sitemap returned HTML instead of XML, creating new sitemap');
      throw new Error('Production sitemap is not valid XML');
    }
  } catch (error) {
    console.log('⚠️  Could not fetch production sitemap:', error.message);
    console.log('📝 Creating new sitemap.xml');
    
    // Create new sitemap if production fetch fails
    sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
  }

  // Check if property already exists in sitemap
  const propertyUrl = `https://elephant.xyz/homes/${propertyId}`;
  if (sitemapContent.includes(propertyUrl)) {
    console.log('✅ Property already exists in sitemap');
    return;
  }

  // Add new property to sitemap
  const newUrlEntry = `  <url>
    <loc>${propertyUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  // Insert before closing urlset tag
  const updatedSitemapContent = sitemapContent.replace(
    '</urlset>',
    `${newUrlEntry}
</urlset>`
  );

  console.log('Writing sitemap to:', sitemapPath);
  await fs.writeFile(sitemapPath, updatedSitemapContent);
  console.log('✅ Added property to sitemap');
  
  // Verify file was created
  if (await fs.pathExists(sitemapPath)) {
    console.log('✅ Sitemap file created successfully');
    const stats = await fs.stat(sitemapPath);
    console.log('File size:', stats.size, 'bytes');
  } else {
    console.log('❌ Sitemap file was not created');
  }
}

testUpdateSitemap().catch(console.error); 