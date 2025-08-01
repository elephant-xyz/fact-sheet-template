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
  
  // Define expected sections for each data type (DRY principle)
  const expectedSections = {
    'seed': ['header-section', 'property-header', 'property-address', 'provider-cards', 'building-details', 'parcel-id'],
    'county': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'building-details', 'features', 'parcel-id'],
    'photo': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'building-details', 'features', 'parcel-id'],
    'photometadata': ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-history', 'floorplan', 'floorplan-layout', 'building-details', 'features', 'parcel-id']
  };
  
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
        
        const foundSections = [];
        for (const section of sections) {
          if (htmlContent.includes(`data-section="${section}"`)) {
            foundSections.push(section);
          }
        }
        
        console.log(`    ✅ Found sections: ${foundSections.join(', ')}`);
        
        // Data-driven content validation based on data type
        const contentValidationChecks = [
          {
            name: 'Seed Data Parcel ID',
            condition: () => dir === 'seed',
            check: () => htmlContent.includes('parcel-id') || htmlContent.includes('Parcel ID'),
            successMessage: 'Parcel ID found in seed data',
            failureMessage: 'Seed data should contain Parcel ID'
          },
          {
            name: 'Comprehensive Data Sections',
            condition: () => dir === 'county' || dir === 'photo' || dir === 'photometadata',
            check: () => {
              const comprehensiveSections = ['property-history', 'floorplan', 'building-details', 'features'];
              const foundSections = comprehensiveSections.filter(section => 
                htmlContent.includes(`data-section="${section}"`)
              );
              console.log(`    ✅ Found comprehensive sections: ${foundSections.join(', ')}`);
              return foundSections.length > 0;
            },
            successMessage: `Comprehensive sections found in ${dir} data`,
            failureMessage: `No comprehensive sections found in ${dir} data`
          },
          {
            name: 'Comprehensive Data Parcel ID',
            condition: () => dir === 'county' || dir === 'photo' || dir === 'photometadata',
            check: () => htmlContent.includes('parcel-id') || htmlContent.includes('Parcel ID'),
            successMessage: `Parcel ID found in ${dir} data`,
            failureMessage: `Parcel ID not found in ${dir} data`
          }
        ];
        
        // Run content validation checks
        for (const check of contentValidationChecks) {
          if (check.condition()) {
            if (check.check()) {
              console.log(`    ✅ ${check.successMessage}`);
            } else {
              console.log(`    ⚠️  ${check.failureMessage}`);
            }
          }
        }
        
        // Data-driven section visibility validation
        console.log(`    🔍 Validating section visibility for ${dir}...`);
        
        const sectionValidationChecks = [
          {
            name: 'Expected Sections',
            check: () => {
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
                return false;
              } else {
                console.log(`      ✅ All expected sections present`);
                return true;
              }
            }
          }
        ];
        
        // Run section validation checks
        for (const check of sectionValidationChecks) {
          check.check();
        }
        
        // Data-driven validation checks
        const validationChecks = [
          {
            name: 'Navigation',
            check: () => htmlContent.includes('nav-tab'),
            successMessage: 'Navigation tabs found',
            failureMessage: 'Navigation tabs not found'
          },
          {
            name: 'Property Address',
            check: () => htmlContent.includes('property-address') || htmlContent.includes('address'),
            successMessage: 'Property address found',
            failureMessage: 'Property address not found'
          },
          {
            name: 'CSS Styling',
            check: () => htmlContent.includes('class='),
            successMessage: 'CSS classes found',
            failureMessage: 'No CSS classes found'
          },
          {
            name: 'Images/Assets',
            check: () => htmlContent.includes('img src=') || htmlContent.includes('assetUrl'),
            successMessage: 'Images/assets found',
            failureMessage: 'No images/assets found'
          },
          {
            name: 'Responsive Design',
            check: () => htmlContent.includes('viewport') || htmlContent.includes('meta name="viewport"'),
            successMessage: 'Responsive viewport meta tag found',
            failureMessage: 'No viewport meta tag found'
          },
          {
            name: 'Accessibility',
            check: () => htmlContent.includes('alt=') || htmlContent.includes('aria-'),
            successMessage: 'Accessibility attributes found',
            failureMessage: 'No accessibility attributes found'
          },
          {
            name: 'Footer/Data Source',
            check: () => htmlContent.includes('data-footnotes') || htmlContent.includes('datasrc'),
            successMessage: 'Footer/data source section found',
            failureMessage: 'Footer/data source section not found'
          },
          {
            name: 'Links',
            check: () => htmlContent.includes('<a href=') || htmlContent.includes('href='),
            successMessage: 'Links found',
            failureMessage: 'No links found'
          },
          {
            name: 'External Links',
            check: () => htmlContent.includes('https://') || htmlContent.includes('http://'),
            successMessage: 'External links found',
            failureMessage: 'No external links found'
          }
        ];
        
        // Run basic validation checks
        for (const check of validationChecks) {
          if (check.check()) {
            console.log(`    ✅ ${check.successMessage}`);
          } else {
            console.log(`    ⚠️  ${check.failureMessage}`);
          }
        }
        
        // Icon validation checks
        console.log(`    🔍 Validating icons and assets...`);
        
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
        
        // Accessibility validation
        const imgTags = htmlContent.match(/<img[^>]*>/g) || [];
        const imgWithAlt = imgTags.filter(img => img.includes('alt='));
        const imgWithoutAlt = imgTags.filter(img => !img.includes('alt='));
        
        console.log(`      📊 Image accessibility: ${imgWithAlt.length}/${imgTags.length} images have alt attributes`);
        if (imgWithoutAlt.length > 0) {
          console.log(`      ⚠️  ${imgWithoutAlt.length} images missing alt attributes`);
        }
        
        // Asset reference counting
        const assetUrls = htmlContent.match(/assetUrl[^"']*["']([^"']+)["']/g) || [];
        const imgSrcs = htmlContent.match(/src=["']([^"']+)["']/g) || [];
        console.log(`      📊 Total asset references: ${assetUrls.length + imgSrcs.length}`);
        
        // Data type specific icon validation
        const dataTypeIconChecks = [
          {
            name: 'Feature Icons',
            condition: () => dir === 'county' || dir === 'photo' || dir === 'photometadata',
            expectedIcons: ['type=bedroom.svg', 'type=bathroom.svg', 'type=flooring.svg', 'type=heating.svg', 'type=cooling.svg'],
            description: 'comprehensive feature icons'
          },
          {
            name: 'Provider Icons',
            condition: () => true, // Always check
            expectedIcons: ['type=real-estate-agent.svg', 'type=appraiser.svg', 'type=inspector.svg', 'type=photographer.svg'],
            description: 'provider icons'
          }
        ];
        
        for (const iconCheck of dataTypeIconChecks) {
          if (iconCheck.condition()) {
            const foundIcons = [];
            for (const expectedIcon of iconCheck.expectedIcons) {
              if (htmlContent.includes(expectedIcon)) {
                foundIcons.push(expectedIcon);
              }
            }
            
            console.log(`      ✅ ${iconCheck.name} found: ${foundIcons.length}/${iconCheck.expectedIcons.length}`);
            if (foundIcons.length < iconCheck.expectedIcons.length) {
              const missingIcons = iconCheck.expectedIcons.filter(icon => !foundIcons.includes(icon));
              console.log(`      ⚠️  Missing ${iconCheck.name.toLowerCase()}: ${missingIcons.join(', ')}`);
            }
            
            if (iconCheck.name === 'Provider Icons' && foundIcons.length > 0) {
              const providerNames = foundIcons.map(icon => icon.replace('type=', '').replace('.svg', ''));
              console.log(`      📋 Found providers: ${providerNames.join(', ')}`);
            }
          }
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
  
  // Data-driven summary generation
  const summarySections = [
    {
      title: '📊 Test Results Summary',
      separator: '========================',
      content: () => {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        const lines = [
          `✅ Successful: ${successful.length}/${results.length}`,
          ...successful.map(result => `  - ${result.directory}: ${result.htmlFiles.length} HTML file(s)`)
        ];
        
        if (failed.length > 0) {
          lines.push(`❌ Failed: ${failed.length}/${results.length}`);
          failed.forEach(result => {
            lines.push(`  - ${result.directory}: ${result.error}`);
          });
        }
        
        lines.push('');
        lines.push(`📁 Test output location: ${outputDir}`);
        lines.push(`🎯 Overall success rate: ${Math.round((successful.length / results.length) * 100)}%`);
        
        return lines;
      }
    },
    {
      title: '📊 HTML Quality Summary',
      separator: '========================',
      content: async () => {
        const lines = [];
        let totalQualityChecks = 0;
        let passedQualityChecks = 0;
        
        for (const result of results) {
          if (result.success) {
            lines.push(`\n📄 ${result.directory.toUpperCase()} HTML Quality:`);
            
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
                  // Use the expectedSections constant defined at function scope
                  const expectedForThisType = expectedSections[result.directory] || [];
                  return expectedForThisType.every(section => htmlContent.includes(`data-section="${section}"`));
                }}
              ];
              
              for (const check of qualityChecks) {
                totalQualityChecks++;
                if (check.check()) {
                  passedQualityChecks++;
                  lines.push(`  ✅ ${check.name}`);
                } else {
                  lines.push(`  ❌ ${check.name}`);
                }
              }
            }
          }
        }
        
        const qualityScore = Math.round((passedQualityChecks / totalQualityChecks) * 100);
        lines.push(`\n🎯 Overall HTML Quality Score: ${qualityScore}% (${passedQualityChecks}/${totalQualityChecks} checks passed)`);
        
        return lines;
      }
    }
  ];
  
  // Generate all summary sections
  for (const section of summarySections) {
    console.log(section.title);
    console.log(section.separator);
    const content = await section.content();
    content.forEach(line => console.log(line));
  }
  
  return results;
}

// Run the test
testGenerateAll().catch(console.error); 