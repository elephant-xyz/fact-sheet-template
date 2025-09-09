# 1.0.0 (2025-09-09)


### Bug Fixes

* incorrect `--inline-svg` processing for some cases ([#52](https://github.com/elephant-xyz/fact-sheet-template/issues/52)) ([1f690ca](https://github.com/elephant-xyz/fact-sheet-template/commit/1f690ca5fecbf9ec62bc272c06e49e6f13fd2800))
* Normalize /properties URLs by appending slash via inline JS ([#65](https://github.com/elephant-xyz/fact-sheet-template/issues/65)) ([ee432d3](https://github.com/elephant-xyz/fact-sheet-template/commit/ee432d3a13aae6f5c44d923ee20082dfefec5834))


### Features

* Add `--inline-svg` option ([#51](https://github.com/elephant-xyz/fact-sheet-template/issues/51)) ([99dacd6](https://github.com/elephant-xyz/fact-sheet-template/commit/99dacd6ada26a659f98f55077436e9175ca03fd4))
* add dynamic icons from lexicon mapping ([#6](https://github.com/elephant-xyz/fact-sheet-template/issues/6)) ([6ba0adc](https://github.com/elephant-xyz/fact-sheet-template/commit/6ba0adcd53a4e1dbd89b868f9e15b8dd8e43333d))
* add floorplan ([#3](https://github.com/elephant-xyz/fact-sheet-template/issues/3)) ([2cbf7a5](https://github.com/elephant-xyz/fact-sheet-template/commit/2cbf7a55c33d710ed9704339e66bd6277cd56e1e))
* **asset:** Add property-specific image support ([3bb6fa9](https://github.com/elephant-xyz/fact-sheet-template/commit/3bb6fa9aaf7c83b22661d0a7693be8283373e45a))
* **asset:** Support custom domain asset URLs ([c1dc595](https://github.com/elephant-xyz/fact-sheet-template/commit/c1dc595dcdd0a47de8d9a24140b5cb384c3442ae))
* **carousel:** add dynamic image carousel support ([8d39029](https://github.com/elephant-xyz/fact-sheet-template/commit/8d39029bc7170a8aa5781530b79d8cb81fa5b8ba))
* **ci:** fix the secret names ([#68](https://github.com/elephant-xyz/fact-sheet-template/issues/68)) ([e9f2b29](https://github.com/elephant-xyz/fact-sheet-template/commit/e9f2b2985771ca3f0fc527febd515bd1d13e5b8f))
* **data:** add data flattening and schema support ([#39](https://github.com/elephant-xyz/fact-sheet-template/issues/39)) ([764e67a](https://github.com/elephant-xyz/fact-sheet-template/commit/764e67a6029d682be6376e88fa4be53372b45b6f))
* **data:** add IPLD property data loader support ([5c2bf62](https://github.com/elephant-xyz/fact-sheet-template/commit/5c2bf6208d1619f65b75ccd3ce39245146e41268))
* **init:** add initial CLI, core, and templates ([6861ca2](https://github.com/elephant-xyz/fact-sheet-template/commit/6861ca2a835b7cd50515a5f526f7a3453af03286))
* **property:** add appliances to property data ([#41](https://github.com/elephant-xyz/fact-sheet-template/issues/41)) ([257a6c6](https://github.com/elephant-xyz/fact-sheet-template/commit/257a6c693ff6f0b0dbc05ec8d1b8f829164668ca))
* **property:** Add image to property template ([94f80cc](https://github.com/elephant-xyz/fact-sheet-template/commit/94f80ccc3a111bce4f128b7143899fd47aa271c9))
* publish to npm ([#67](https://github.com/elephant-xyz/fact-sheet-template/issues/67)) ([882ee45](https://github.com/elephant-xyz/fact-sheet-template/commit/882ee453372cac2b4cc40e5eb339ba845d67b0cc))
* Remove `manifest.json` generation. ([#49](https://github.com/elephant-xyz/fact-sheet-template/issues/49)) ([defd9f8](https://github.com/elephant-xyz/fact-sheet-template/commit/defd9f8bd92333ee4aea9d818ba8b52e5e863719))
* **ui:** add svg icons & improve property page ([6ac6a21](https://github.com/elephant-xyz/fact-sheet-template/commit/6ac6a210d80959f6168c864749155391def31513))

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
