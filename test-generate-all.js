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
        
        // Comprehensive content validation
        console.log(`  📄 Analyzing ${htmlFile}...`);
        
        // Check for key sections
        const sections = [
          'header-section',
          'property-header', 
          'property-address',
          'provider-cards'
        ];
        
const foundSections = sections.filter(section => htmlContent.includes(`data-section="${section}"`));
        
        console.log(`    ✅ Found sections: ${foundSections.join(', ')}`);
        
        // Check for specific content based on data type
        if (dir === 'seed') {
if (!htmlContent.toLowerCase().includes('parcel-id')) {
          } else {
            console.log(`    ✅ Parcel ID found in seed data`);
          }
        }
        
        if (dir === 'county' || dir === 'photo' || dir === 'photometadata') {
          // These should have more comprehensive sections
          const comprehensiveSections = [
            'property-history',
            'floorplan',
            'building-details',
            'features'
          ];
          
          const foundComprehensiveSections = [];
          for (const section of comprehensiveSections) {
            if (htmlContent.includes(`data-section="${section}"`)) {
              foundComprehensiveSections.push(section);
            }
          }
          
          console.log(`    ✅ Found comprehensive sections: ${foundComprehensiveSections.join(', ')}`);
          
          // Check for parcel ID in comprehensive data
          if (htmlContent.includes('parcel-id') || htmlContent.includes('Parcel ID')) {
            console.log(`    ✅ Parcel ID found in ${dir} data`);
          } else {
            console.log(`    ⚠️  Parcel ID not found in ${dir} data`);
          }
        }
        
        // Validate section visibility configuration
        console.log(`    🔍 Validating section visibility for ${dir}...`);
        
        // Define expected sections for each data type based on section-visibility.json
        const expectedSections = {
          'seed': ['header-section', 'property-header', 'property-address', 'provider-cards', 'building-details', 'parcel-id'],
          'county': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'building-details', 'features', 'parcel-id'],
          'photo': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'building-details', 'features', 'parcel-id'],
          'photometadata': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'floorplan-layout', 'building-details', 'features', 'parcel-id']
        };
        
        const expectedForThisType = expectedSections[dir] || [];
        const foundExpectedSections = [];
        const missingExpectedSections = [];
        
        for (const expectedSection of expectedForThisType) {
          if (htmlContent.includes(`data-section="${expectedSection}"`)) {
            foundExpectedSections.push(expectedSection);
          } else {
            missingExpectedSections.push(expectedSection);
          }
        }
        
        console.log(`      ✅ Found expected sections: ${foundExpectedSections.join(', ')}`);
        if (missingExpectedSections.length > 0) {
          console.log(`      ❌ Missing expected sections: ${missingExpectedSections.join(', ')}`);
        } else {
          console.log(`      ✅ All expected sections present`);
        }
        
        // Check for navigation
        if (htmlContent.includes('nav-tab')) {
          console.log(`    ✅ Navigation tabs found`);
        } else {
          console.log(`    ⚠️  Navigation tabs not found`);
        }
        
        // Check for property information
        if (htmlContent.includes('property-address') || htmlContent.includes('address')) {
          console.log(`    ✅ Property address found`);
        } else {
          console.log(`    ⚠️  Property address not found`);
        }
        
        // Check for styling
        if (htmlContent.includes('class=')) {
          console.log(`    ✅ CSS classes found`);
        } else {
          console.log(`    ⚠️  No CSS classes found`);
        }
        
        // Check for images/assets
        if (htmlContent.includes('img src=') || htmlContent.includes('assetUrl')) {
          console.log(`    ✅ Images/assets found`);
        } else {
          console.log(`    ⚠️  No images/assets found`);
        }
        
        // Validate icon presence and accessibility
        console.log(`    🔍 Validating icons and assets...`);
        
        // Check for specific icon types
        const iconChecks = [
          { name: 'Provider Icons', pattern: /type=.*\.svg/g, description: 'Provider type icons (real-estate-agent, appraiser, etc.)' },
          { name: 'Feature Icons', pattern: /featuresicons/g, description: 'Property feature icons' },
          { name: 'UI Icons', pattern: /uiicons/g, description: 'User interface icons' },
          { name: 'Navigation Icons', pattern: /dropdown-arrow|carat-down/g, description: 'Navigation arrow icons' },
          { name: 'Avatar Images', pattern: /_headshot\.png|\.jpg/g, description: 'Provider avatar images' }
        ];
        
        for (const iconCheck of iconChecks) {
          const matches = htmlContent.match(iconCheck.pattern);
          if (matches && matches.length > 0) {
            console.log(`      ✅ ${iconCheck.name}: ${matches.length} found (${iconCheck.description})`);
          } else {
            console.log(`      ⚠️  ${iconCheck.name}: None found (${iconCheck.description})`);
          }
        }
        
        // Check for icon accessibility (alt attributes)
        const imgTags = htmlContent.match(/<img[^>]*>/g) || [];
        const imgWithAlt = imgTags.filter(img => img.includes('alt='));
        const imgWithoutAlt = imgTags.filter(img => !img.includes('alt='));
        
        console.log(`      📊 Image accessibility: ${imgWithAlt.length}/${imgTags.length} images have alt attributes`);
        if (imgWithoutAlt.length > 0) {
          console.log(`      ⚠️  ${imgWithoutAlt.length} images missing alt attributes`);
        }
        
        // Check for broken image references
        const assetUrls = htmlContent.match(/assetUrl[^"']*["']([^"']+)["']/g) || [];
        const imgSrcs = htmlContent.match(/src=["']([^"']+)["']/g) || [];
        
        console.log(`      📊 Total asset references: ${assetUrls.length + imgSrcs.length}`);
        
        // Check for specific expected icons based on data type
        if (dir === 'county' || dir === 'photo' || dir === 'photometadata') {
          // These should have comprehensive feature icons
          const expectedFeatureIcons = [
            'type=bedroom.svg',
            'type=bathroom.svg', 
            'type=flooring.svg',
            'type=heating.svg',
            'type=cooling.svg'
          ];
          
          const foundFeatureIcons = [];
          for (const expectedIcon of expectedFeatureIcons) {
            if (htmlContent.includes(expectedIcon)) {
              foundFeatureIcons.push(expectedIcon);
            }
          }
          
          console.log(`      ✅ Feature icons found: ${foundFeatureIcons.length}/${expectedFeatureIcons.length}`);
          if (foundFeatureIcons.length < expectedFeatureIcons.length) {
            console.log(`      ⚠️  Missing feature icons: ${expectedFeatureIcons.filter(icon => !foundFeatureIcons.includes(icon)).join(', ')}`);
          }
        }
        
        // Check for provider icons
        const providerIcons = [
          'type=real-estate-agent.svg',
          'type=appraiser.svg',
          'type=inspector.svg',
          'type=photographer.svg'
        ];
        
        const foundProviderIcons = [];
        for (const providerIcon of providerIcons) {
          if (htmlContent.includes(providerIcon)) {
            foundProviderIcons.push(providerIcon);
          }
        }
        
        console.log(`      ✅ Provider icons found: ${foundProviderIcons.length}/${providerIcons.length}`);
        if (foundProviderIcons.length > 0) {
          console.log(`      📋 Found providers: ${foundProviderIcons.map(icon => icon.replace('type=', '').replace('.svg', '')).join(', ')}`);
        }
        
        // Check for responsive design
        if (htmlContent.includes('viewport') || htmlContent.includes('meta name="viewport"')) {
          console.log(`    ✅ Responsive viewport meta tag found`);
        } else {
          console.log(`    ⚠️  No viewport meta tag found`);
        }
        
        // Check for accessibility
        if (htmlContent.includes('alt=') || htmlContent.includes('aria-')) {
          console.log(`    ✅ Accessibility attributes found`);
        } else {
          console.log(`    ⚠️  No accessibility attributes found`);
        }
        
        // Check for footer and data source information
        if (htmlContent.includes('data-footnotes') || htmlContent.includes('datasrc')) {
          console.log(`    ✅ Footer/data source section found`);
        } else {
          console.log(`    ⚠️  Footer/data source section not found`);
        }
        
        // Check for links
        if (htmlContent.includes('<a href=') || htmlContent.includes('href=')) {
          console.log(`    ✅ Links found`);
        } else {
          console.log(`    ⚠️  No links found`);
        }
        
        // Check for external links or data source URLs
        if (htmlContent.includes('https://') || htmlContent.includes('http://')) {
          console.log(`    ✅ External links found`);
        } else {
          console.log(`    ⚠️  No external links found`);
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
  
  // Quality summary
  console.log('\n📊 HTML Quality Summary:');
  console.log('========================');
  
  let totalQualityChecks = 0;
  let passedQualityChecks = 0;
  
  for (const result of results) {
    if (result.success) {
      console.log(`\n📄 ${result.directory.toUpperCase()} HTML Quality:`);
      
      // Count quality indicators in the HTML files
      for (const htmlFile of result.htmlFiles) {
        const htmlPath = path.join(outputDir, result.directory, htmlFile);
        const htmlContent = await fs.readFile(htmlPath, 'utf8');
        
        const qualityChecks = [
          { name: 'Basic HTML Structure', check: () => htmlContent.includes('<!DOCTYPE html>') && htmlContent.includes('<html') && htmlContent.includes('</html>') },
          { name: 'CSS Styling', check: () => htmlContent.includes('class=') },
          { name: 'Navigation', check: () => htmlContent.includes('nav-tab') },
          { name: 'Property Address', check: () => htmlContent.includes('property-address') || htmlContent.includes('address') },
          { name: 'Images/Assets', check: () => htmlContent.includes('img src=') || htmlContent.includes('assetUrl') },
          { name: 'Icon Accessibility', check: () => {
            const imgTags = htmlContent.match(/<img[^>]*>/g) || [];
            const imgWithAlt = imgTags.filter(img => img.includes('alt='));
            return imgTags.length === 0 || imgWithAlt.length === imgTags.length;
          }},
          { name: 'Provider Icons', check: () => htmlContent.includes('type=real-estate-agent.svg') || htmlContent.includes('type=appraiser.svg') },
          { name: 'Feature Icons', check: () => {
            // Seed data doesn't have features section, so don't expect feature icons
            if (result.directory === 'seed') {
              return true; // Skip this check for seed data
            }
            return htmlContent.includes('featuresicons') || htmlContent.includes('type=bedroom.svg');
          }},
          { name: 'Responsive Design', check: () => htmlContent.includes('viewport') },
          { name: 'Accessibility', check: () => htmlContent.includes('alt=') || htmlContent.includes('aria-') },
          { name: 'Section Visibility Logic', check: () => htmlContent.includes('data-section=') },
          { name: 'Parcel ID Section', check: () => htmlContent.includes('parcel-id') || htmlContent.includes('Parcel ID') },
          { name: 'Footer/Data Source', check: () => htmlContent.includes('data-footnotes') || htmlContent.includes('datasrc') },
          { name: 'Links', check: () => htmlContent.includes('<a href=') || htmlContent.includes('href=') },
          { name: 'External Links', check: () => htmlContent.includes('https://') || htmlContent.includes('http://') },
          { name: 'Section Visibility Config', check: () => {
            const expectedSections = {
              'seed': ['header-section', 'property-header', 'property-address', 'provider-cards', 'building-details', 'parcel-id'],
              'county': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'building-details', 'features', 'parcel-id'],
              'photo': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'building-details', 'features', 'parcel-id'],
              'photometadata': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'floorplan-layout', 'building-details', 'features', 'parcel-id']
            };
            const expectedForThisType = expectedSections[result.directory] || [];
            return expectedForThisType.every(section => htmlContent.includes(`data-section="${section}"`));
          }}
        ];
        
        for (const check of qualityChecks) {
          totalQualityChecks++;
          if (check.check()) {
            passedQualityChecks++;
            console.log(`  ✅ ${check.name}`);
          } else {
            console.log(`  ❌ ${check.name}`);
          }
        }
      }
    }
  }
  
const qualityScore = totalQualityChecks > 0 ? Math.round((passedQualityChecks / totalQualityChecks) * 100) : 100;
  console.log(`\n🎯 Overall HTML Quality Score: ${qualityScore}% (${passedQualityChecks}/${totalQualityChecks} checks passed)`);
  
  return results;
}

// Run the test
testGenerateAll().catch(console.error); 