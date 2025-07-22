# Elephant Fact Sheet

A command-line tool to generate self-contained property fact sheet websites from JSON data, optimized for IPFS deployment.

## Installation

### Global Installation (Recommended)
```bash
npm install -g @elephant/fact-sheet
```

### Using npx (No Installation Required)
```bash
npx @elephant/fact-sheet generate --input ./data --output ./websites
```

### Local Installation
```bash
npm install @elephant/fact-sheet
npx fact-sheet generate --input ./data --output ./websites
```

## Usage

```bash
fact-sheet generate --input <data-dir> --output <output-dir> [options]
```

### Options

- `-i, --input <dir>` - Input directory with property data (required)
- `-o, --output <dir>` - Output directory for websites (required)  
- `-d, --domain <url>` - Domain for static assets (default: https://elephant.xyz)
- `--inline-css` - Inline all CSS into HTML
- `--inline-js` - Inline all JavaScript into HTML
- `-v, --verbose` - Verbose output

### Examples

**Basic usage:**
```bash
fact-sheet generate --input ./data --output ./websites
```

**With inlined assets (IPFS-optimized):**
```bash
fact-sheet generate --input ./data --output ./websites --inline-css --inline-js
```

**With custom domain:**
```bash
fact-sheet generate --input ./data --output ./websites --domain https://my-domain.com
```

**Using npx:**
```bash
npx @elephant/fact-sheet generate --input ./data --output ./websites --inline-css --inline-js
```

## Input Data Structure

The input directory should contain subdirectories for each property, with JSON files following the [Elephant Lexicon](https://lexicon.elephant.xyz/) schema:

```
data/
├── 30434108090030050/          # Property ID folder
│   ├── address.json
│   ├── property.json
│   ├── sales_1.json
│   ├── tax_1.json
│   └── ...
├── 52434205310037080/          # Another property
│   ├── address.json
│   ├── property.json
│   └── ...
```

## Output Structure

Each property becomes a self-contained website:

```
output/
├── 30434108090030050/
│   ├── index.html              # Property page
│   ├── css/styles.css          # (unless inlined)
│   ├── js/property.js          # (unless inlined)
│   ├── assets/                 # Icons and static assets
│   └── manifest.json           # Build metadata
├── 52434205310037080/
│   └── ...
```

## Features

- **Self-contained websites** - Each property is a complete website
- **IPFS-ready** - Optimized for distributed web deployment
- **Asset inlining** - Option to inline CSS/JS for offline use
- **Configurable domains** - Use custom domains for asset URLs
- **Fast builds** - Parallel processing for multiple properties
- **Detailed manifests** - JSON metadata for each generated site

## Development

```bash
# Test with sample data
npm run dev -- --input ../src/_data/homes --output ./test-output --verbose

# Test with inlined assets
npm run dev -- --input ../src/_data/homes --output ./test-inline --inline-css --inline-js

# Run tests
npm test

# Run examples
npm run example
npm run example-inline
```