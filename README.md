# Elephant Fact Sheet Template

Generate beautiful, self-contained property fact sheets from your real estate data. This template system creates static websites optimized for IPFS deployment, perfect for decentralized property listings.

## 🚀 Quick Start

Since this repository is not published to npm, use it directly from GitHub:

```bash
# Generate fact sheets using npx (recommended for basic usage)
npx github:elephant-xyz/fact-sheet-template generate --input ./data --output ./websites

# For development with hot reload, clone the repository
git clone https://github.com/elephant-xyz/fact-sheet-template.git
cd fact-sheet-template
npm install  # This installs all dependencies including dev dependencies
npm run build
npm run dev:server -- --input ./example-data --output ./dev-output --open
```

> **Note:** The `dev` command requires additional dependencies. Use the clone method if you need the development server with hot reload.

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

## 🎨 Template Development Guide

This repository is designed for developers who want to customize the property fact sheet templates. Here's everything you need to know:

### Project Structure

```
fact-sheet-template/
├── templates/              # Nunjucks templates
│   ├── base.njk           # Base HTML layout
│   ├── property.njk       # Property page template
│   └── assets/            # Static assets
│       ├── css/           # Stylesheets
│       ├── js/            # JavaScript files
│       └── static/        # Icons and images
├── lib/                   # TypeScript source files
│   ├── builder.ts         # Main build logic
│   ├── dev-server.ts      # Development server
│   └── ...
├── example-data/          # Sample property data
└── bin/                   # CLI executable
```

### Setting Up Development Environment

1. **Clone the repository:**

   ```bash
   git clone https://github.com/elephant-xyz/fact-sheet-template.git
   cd fact-sheet-template
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Build the TypeScript files:**

   ```bash
   npm run build
   ```

4. **Start development with hot reload:**
   ```bash
   npm run dev:server -- --input ./example-data --output ./dev-output --port 3000 --open
   ```

### Development Workflow

#### 1. Live Development Server

The development server provides instant feedback as you modify templates:

```bash
# Start dev server with live reload
npm run dev:server -- --input ./example-data --output ./dev-output --open

# Custom port
npm run dev:server -- --input ./example-data --output ./dev-output --port 8080

# Without auto-opening browser
npm run dev:server -- --input ./example-data --output ./dev-output --no-open
```

Features:

- 🔄 **Hot reload** - Changes to templates instantly refresh the browser
- 📁 **File watching** - Monitors both templates and data files
- 🚀 **Fast rebuilds** - Only rebuilds affected properties
- 🔍 **Error display** - Shows template errors in the browser

#### 2. Customizing Templates

The templates use [Nunjucks](https://mozilla.github.io/nunjucks/) templating engine.

**Main template files:**

- `templates/base.njk` - Base HTML structure, meta tags, and common elements
- `templates/property.njk` - Property-specific layout and data display
- `templates/assets/css/root_style.css` - Main stylesheet
- `templates/assets/js/property.js` - Client-side JavaScript

**Template variables available:**

```nunjucks
{# Property data #}
{{ homes[property_id].address }}           # Address information
{{ homes[property_id].building }}          # Building details
{{ homes[property_id].all_sales }}         # Sales history array
{{ homes[property_id].all_taxes }}         # Tax records array
{{ homes[property_id].rent }}              # Rental information

{# Configuration #}
{{ config.domain }}                        # Asset domain
{{ config.inlineCss }}                     # CSS inlining flag
{{ config.inlineJs }}                      # JS inlining flag

{# Helpers #}
{{ 'filename.svg' | assetUrl }}            # Generate asset URL
{{ value | number }}                       # Format numbers with commas
{{ date | date('MMMM YYYY') }}            # Format dates
```

**Example template modification:**

```nunjucks
{# Add a new section to property.njk #}
<section class="property-amenities">
  <h2>Amenities</h2>
  {% if homes[property_id].amenities %}
    <ul>
    {% for amenity in homes[property_id].amenities %}
      <li>{{ amenity.name }}</li>
    {% endfor %}
    </ul>
  {% else %}
    <p>No amenities data available</p>
  {% endif %}
</section>
```

#### 3. Styling Your Templates

Modify `templates/assets/css/root_style.css` to customize the appearance:

```css
/* Add custom styles */
.property-amenities {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.property-amenities h2 {
  color: #333;
  margin-bottom: 1rem;
}
```

#### 4. Adding JavaScript Functionality

Edit `templates/assets/js/property.js` to add interactive features:

```javascript
// Add interactive map
document.addEventListener("DOMContentLoaded", function () {
  const mapContainer = document.getElementById("property-map");
  if (mapContainer && window.propertyData.latitude) {
    // Initialize your map library here
    initializeMap(window.propertyData.latitude, window.propertyData.longitude);
  }
});
```

#### 5. Testing Your Changes

```bash
# Run with sample data
npm run example

# Run with your own data
npm run dev -- --input ./my-data --output ./test-output --verbose

# Test IPFS-optimized build (with inlined assets)
npm run example-inline
```

### Build Options

| Option          | Description                        | Default              |
| --------------- | ---------------------------------- | -------------------- |
| `--input, -i`   | Directory containing property data | Required             |
| `--output, -o`  | Directory for generated websites   | Required             |
| `--domain, -d`  | Domain for asset URLs              | https://elephant.xyz |
| `--inline-css`  | Embed CSS directly in HTML         | false                |
| `--inline-js`   | Embed JavaScript directly in HTML  | false                |
| `--verbose, -v` | Show detailed build information    | false                |

### Advanced Usage

#### Custom Asset Domain

```bash
# Use your own CDN
npx github:elephant-xyz/fact-sheet-template generate \
  --input ./data \
  --output ./websites \
  --domain https://cdn.mysite.com
```

#### IPFS-Optimized Build

```bash
# Inline all assets for IPFS deployment
npx github:elephant-xyz/fact-sheet-template generate \
  --input ./data \
  --output ./ipfs-ready \
  --inline-css \
  --inline-js
```

#### Programmatic Usage

```javascript
import { Builder } from "./lib/builder.js";

const builder = new Builder({
  input: "./data",
  output: "./websites",
  domain: "https://my-domain.com",
  inlineCss: true,
  inlineJs: true,
  verbose: true,
});

await builder.build();
```

### Data Schema

Your property data should follow the [Elephant Lexicon](https://lexicon.elephant.xyz/) schema. Here's a minimal example:

**address.json:**

```json
{
  "street_number": "123",
  "street_name": "Main",
  "street_suffix_type": "Street",
  "city_name": "Springfield",
  "state_code": "IL",
  "postal_code": "62701",
  "latitude": 39.7817,
  "longitude": -89.6501
}
```

**building.json:**

```json
{
  "property_type": "Single Family",
  "bedrooms": 3,
  "bathrooms": 2,
  "total_sqft": 1850,
  "year_built": 1995
}
```

### Deployment

Generated websites are self-contained and can be deployed anywhere:

- **IPFS**: Use `--inline-css --inline-js` for best results
- **Static hosting**: Upload the output directory to any web server
- **CDN**: Each property folder is independent and cacheable
- **Local viewing**: Open `index.html` directly in a browser

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly with `npm test` and `npm run example`
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Troubleshooting

**Build fails with "Template not found"**

- Ensure you've run `npm run build` after cloning
- Check that template files exist in `templates/` directory

**Development server not reloading**

- Check console for WebSocket connection errors
- Try a different port if 3000 is in use
- Ensure your browser allows WebSocket connections

**Assets not loading**

- Verify the `--domain` option matches your deployment URL
- Use `--inline-css` and `--inline-js` for local file:// viewing

### License

AGPL-3.0-or-later - See LICENSE file for details

### Support

- 📖 [Documentation](https://lexicon.elephant.xyz/)
- 🐛 [Report Issues](https://github.com/elephant-xyz/fact-sheet-template/issues)
- 💬 [Discussions](https://github.com/elephant-xyz/fact-sheet-template/discussions)

