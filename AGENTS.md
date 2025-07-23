# Elephant Fact Sheet CLI - Agent Guidelines

## Build & Test Commands
- **Build**: `npm run build` - Compiles TypeScript to JavaScript
- **Test**: `npm run test` - Runs test suite (requires build first)
- **Dev**: `npm run dev` - Generates fact sheets in development mode
- **Dev Server**: `npm run dev:server` - Starts development server with hot reload
- **Watch**: `npm run watch` - Watches TypeScript files for changes

## Code Style & Conventions
- **Language**: TypeScript with ES modules (`"type": "module"`)
- **Target**: ES2023, strict mode enabled
- **Imports**: Use `.js` extensions for local imports (e.g., `import { DataLoader } from './data-loader.js'`)
- **File Structure**: Source in `lib/`, types in `types/`, templates in `templates/`
- **Naming**: PascalCase for classes, camelCase for functions/variables
- **Error Handling**: Use try-catch blocks, log errors via Logger class
- **Logging**: Use Logger class methods (info, warn, error, success, verbose)
- **Type Safety**: Define interfaces in `types/property.d.ts`, avoid `any` when possible
- **No Linter**: Project doesn't have ESLint configured yet
- **Testing**: Tests use fs-extra for file operations, clean up test artifacts

## Key Architecture Notes
- Builder pattern for main functionality
- Modular design: DataLoader, TemplateRenderer, AssetManager, Logger
- Supports both regular and IPLD data loading
- Nunjucks templating engine for HTML generation