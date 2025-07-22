# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-07-22

### Added
- Initial release of Elephant Fact Sheet CLI
- Command-line interface for generating self-contained property websites
- Support for Elephant Lexicon JSON data format
- Template rendering with Nunjucks
- Asset management with inline/external options
- IPFS-optimized builds with `--inline-css` and `--inline-js` flags
- Custom domain support with `--domain` option
- Comprehensive test suite
- Detailed build manifests for each property
- Progress indicators and verbose logging
- Self-contained website generation (each property as complete website)

### Features
- **Data Processing**: Automatic aggregation of sales, tax, and relationship data
- **Template System**: Responsive property page templates with navigation
- **Asset Optimization**: Choice between external assets or fully inlined for offline use
- **Build Performance**: Parallel processing for multiple properties
- **Developer Experience**: Verbose logging, progress indicators, and error handling
- **IPFS Ready**: Optimized output structure for distributed web deployment

### Supported Data Types
- Address information
- Building details (bedrooms, bathrooms, square footage)
- Sales history and transactions
- Tax assessments and valuations
- Property relationships and ownership
- Custom property metadata

### CLI Commands
- `generate`: Generate property fact sheet websites from JSON data

### Generate Command Options
- `-i, --input <dir>`: Input directory with property data (required)
- `-o, --output <dir>`: Output directory for websites (required)
- `-d, --domain <url>`: Domain for static assets (default: https://elephant.xyz)
- `--inline-css`: Inline all CSS into HTML
- `--inline-js`: Inline all JavaScript into HTML
- `-v, --verbose`: Verbose output
- `-h, --help`: Display help information