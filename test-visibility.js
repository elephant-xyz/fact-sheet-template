#!/usr/bin/env node

import { SectionVisibilityFilter } from './dist/lib/section-visibility-filter.js';

// Test data with different labels
const testData = {
  // Test data with "Seed" label
  seedData: {
    property: {
      label: "Seed",
      address: "123 Main St"
    }
  },
  
  // Test data with "County" label
  countyData: {
    property: {
      label: "County",
      address: "456 Oak Ave"
    }
  },
  
  // Test data with "Photo" label
  photoData: {
    property: {
      label: "Photo",
      address: "789 Pine Rd"
    }
  },
  
  // Test data with "Photo Metadata" label
  photoMetadataData: {
    property: {
      label: "Photo Metadata",
      address: "321 Elm St"
    }
  },
  
  // Test data with no labels
  noLabelData: {
    property: {
      address: "999 Test St"
    }
  }
};

const visibilityFilter = new SectionVisibilityFilter();

console.log('🔍 Testing Section Visibility Filter\n');

// Test each data type
Object.entries(testData).forEach(([dataName, data]) => {
  console.log(`📊 Testing ${dataName}:`);
  
  // Check which labels are present
  const labels = ['Seed', 'County', 'Photo', 'Photo Metadata'];
  const foundLabels = labels.filter(label => visibilityFilter.hasLabel(data, label));
  
  console.log(`   Found labels: ${foundLabels.length > 0 ? foundLabels.join(', ') : 'none'}`);
  
  // Get visible divs
  const visibleDivs = visibilityFilter.getVisibleDivs(data);
  console.log(`   Visible divs: ${visibleDivs.length > 0 ? visibleDivs.join(', ') : 'none'}`);
  
  // Test specific divs
  const testDivs = ['header-section', 'property-header', 'property-address', 'provider-cards', 'property-divider'];
  testDivs.forEach(divId => {
    const isVisible = visibilityFilter.isDivVisible(data, divId);
    console.log(`   ${divId}: ${isVisible ? '✅ visible' : '❌ hidden'}`);
  });
  
  console.log('');
});

console.log('🎯 Expected Results:');
console.log('- Seed data should show: header-section, property-header, property-address, provider-cards, property-divider');
console.log('- County data should show: property-history, tax-information, building-details');
console.log('- Photo data should show: photo-gallery, property-history');
console.log('- Photo Metadata data should show: photo-gallery, property-details, features');
console.log('- No label data should show: none'); 