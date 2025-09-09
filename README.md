# Elephant Fact Sheet Template

Generate beautiful, self-contained property fact sheets from your real estate data. This template system creates static websites optimized for IPFS deployment, perfect for decentralized property listings.

## 🚀 Quick Start

```bash
npx @elephant-xyz/fact-sheet generate --input ./data --output ./websites
```

## 📋 What You'll Need

Your property data should be organized in folders, with each property having its own directory containing JSON files:

```
data/
├── property-id-1/
│   ├── address.json      # Property address details
│   ├── building.json     # Building specifications
│   ├── sales_1.json      # Sales history
│   └── tax_1.json        # Tax information
└── property-id-2/
    └── ... (same structure)
```

The JSON files should follow the [Elephant Lexicon](https://lexicon.elephant.xyz/) schema.

## Usage

### Generate Command

The main command to generate the fact sheets is `generate`:

```bash
fact-sheet generate --input <your-data-directory> --output <your-output-directory>
```

### Build Options

| Option          | Description                        | Default              |
| --------------- | ---------------------------------- | -------------------- |
| `--input, -i`   | Directory containing property data | Required             |
| `--output, -o`  | Directory for generated websites   | Required             |
| `--domain, -d`  | Domain for asset URLs              | https://elephant.xyz |
| `--inline-css`  | Embed CSS directly in HTML         | false                |
| `--inline-js`   | Embed JavaScript directly in HTML  | false                |
| `--inline-svg`  | Embed SVG icons directly in HTML   | false                |
| `--minify`      | Minify HTML, CSS, and JavaScript   | false                |
| `--verbose, -v` | Show detailed build information    | false                |

## Advanced Usage

### Custom Asset Domain

```bash
# Use your own CDN
npx @elephant-xyz/fact-sheet generate \
  --input ./data \
  --output ./websites \
  --domain https://cdn.mysite.com
```

### IPFS-Optimized Build

For IPFS, it's best to inline all assets to create a single, self-contained HTML file.

```bash
# Inline all assets for IPFS deployment
npx @elephant-xyz/fact-sheet generate \
  --input ./data \
  --output ./ipfs-ready \
  --inline-css \
  --inline-js \
  --inline-svg
```

For a production-ready build, you can also add the `--minify` flag.

## Deployment

Generated websites are self-contained and can be deployed anywhere:

- **IPFS**: Use `--inline-css --inline-js --inline-svg` for best results.
- **Static hosting**: Upload the output directory to any web server (e.g., Netlify, Vercel, AWS S3).
- **CDN**: Each property folder is independent and cacheable.

## Troubleshooting

*   **Assets not loading**: Verify the `--domain` option matches your deployment URL. For local viewing, use `--inline-css` and `--inline-js`.
*   **Data not appearing correctly**: Ensure your JSON data conforms to the [Elephant Lexicon](https://lexicon.elephant.xyz/) schema.

## License

AGPL-3.0-or-later

## Support

- 📖 [Documentation](https://lexicon.elephant.xyz/)
- 🐛 [Report Issues](https://github.com/elephant-xyz/fact-sheet-template/issues)
- 💬 [Discussions](https://github.com/elephant-xyz/fact-sheet-template/discussions)