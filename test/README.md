# Test Suite

This directory contains all test-related files and outputs for the fact-sheet-template project.

## Structure

- `test-generate-all.js` - Main test script that generates HTML for all example data types
- `test-output/` - Generated HTML files from test runs
- `saved-html-files/` - Reference HTML files saved for comparison
- `reference-output/` - Reference files for HTML comparison (created when needed)

## Usage

### Run all tests
```bash
cd test
node test-generate-all.js
```

### Create reference files
```bash
cd test
node test-generate-all.js --create-reference
```

### Test specific data type
```bash
cd ..
node bin/fact-sheet.js generate -i example-data/seed -o test/test-output/seed
```

## Test Outputs

The test generates HTML files for each data type:
- **Seed data** - Basic property information
- **Seed2 data** - Alternative seed format
- **Seed3 data** - Another seed variant
- **County data** - County property records
- **Photo data** - Property with photo metadata
- **Photo Metadata data** - Comprehensive photo metadata
- **Metadata Notebook data** - Notebook-style metadata

## HTML Comparison

The test includes HTML-to-HTML comparison functionality:
- Compares generated files with reference files
- Normalizes whitespace for accurate comparison
- Reports exact matches and differences
- Helps ensure consistent output across changes

## Saved HTML Files

The `saved-html-files/` directory contains reference HTML files:
- `seed-index.html` - Original seed data output
- `seed2-index.html` - Seed2 data output
- `seed3-index.html` - Seed3 data output (with county fix)
- `county-index.html` - County data output
- `photo-index.html` - Photo data output
- `photometadata-index.html` - Photo metadata output
- `metadatanotebook-index.html` - Metadata notebook output

These files can be used as reference for manual inspection or as baseline files for future testing. 