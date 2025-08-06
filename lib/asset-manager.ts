import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BuilderOptions, PropertyData } from '../types/property.js';
import { Logger } from './logger.js';
import { Minifier } from './minifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AssetManager {
  private options: BuilderOptions;
  private templatesPath: string;
  private logger: Logger;
  private minifier: Minifier;

  constructor(options: BuilderOptions) {
    this.options = options;
    this.templatesPath = path.join(__dirname, '..', '..', 'templates');
    this.logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: options.ci,
      logFile: options.logFile
    });
    this.minifier = new Minifier(options.minify || false, this.logger);
  }

  async copyAssets(outputDir: string, propertyId: string, propertyDataPath?: string, propertyData?: PropertyData): Promise<void> {
    const propertyDir = path.join(outputDir, propertyId);
    
    this.logger.debug(`Copying assets for ${propertyId}...`);

    // Copy CSS files (unless inlining)
    if (!this.options.inlineCss) {
      await this.copyCSSAssets(propertyDir);
    }

    // Copy JS files (unless inlining)
    if (!this.options.inlineJs) {
      await this.copyJSAssets(propertyDir);
    }

    // Always copy static assets for local builds
    await this.copyStaticAssets(propertyDir);

    // Copy property-specific images if they exist
    if (propertyDataPath && propertyData) {
      await this.copyPropertyImages(propertyDir, propertyDataPath, propertyData);
    }
  }

  private async copyCSSAssets(propertyDir: string): Promise<void> {
    const cssSourceDir = path.join(this.templatesPath, 'assets', 'css');
    const cssTargetDir = path.join(propertyDir, 'css');

    if (await fs.pathExists(cssSourceDir)) {
      await fs.ensureDir(cssTargetDir);
      
      // Copy and optionally minify CSS files
      const files = await fs.readdir(cssSourceDir);
      for (const file of files) {
        if (file.endsWith('.css')) {
          const sourcePath = path.join(cssSourceDir, file);
          const targetPath = path.join(cssTargetDir, file);
          let content = await fs.readFile(sourcePath, 'utf8');
          
          if (this.options.minify) {
            content = await this.minifier.minifyCSS(content, file);
          }
          
          await fs.writeFile(targetPath, content, 'utf8');
        } else {
          // Copy non-CSS files as-is
          await fs.copy(path.join(cssSourceDir, file), path.join(cssTargetDir, file));
        }
      }
      
      this.logger.debug(`Copied CSS assets to css/`);
    }
  }

  private async copyJSAssets(propertyDir: string): Promise<void> {
    const jsSourceDir = path.join(this.templatesPath, 'assets', 'js');
    const jsTargetDir = path.join(propertyDir, 'js');

    if (await fs.pathExists(jsSourceDir)) {
      await fs.ensureDir(jsTargetDir);
      
      // Copy and optionally minify JS files
      const files = await fs.readdir(jsSourceDir);
      for (const file of files) {
        if (file.endsWith('.js') && !file.endsWith('.min.js')) {
          const sourcePath = path.join(jsSourceDir, file);
          const targetPath = path.join(jsTargetDir, file);
          let content = await fs.readFile(sourcePath, 'utf8');
          
          if (this.options.minify) {
            content = await this.minifier.minifyJS(content, file);
          }
          
          await fs.writeFile(targetPath, content, 'utf8');
        } else {
          // Copy already minified or non-JS files as-is
          await fs.copy(path.join(jsSourceDir, file), path.join(jsTargetDir, file));
        }
      }
      
      this.logger.debug(`Copied JS assets to js/`);
    }
  }

  private async copyStaticAssets(propertyDir: string): Promise<void> {
    // Copy static directory contents to root of property directory
    const staticSourceDir = path.join(this.templatesPath, 'assets', 'static');
    
    if (await fs.pathExists(staticSourceDir)) {
      const files = await fs.readdir(staticSourceDir);
      
      for (const file of files) {
        const sourcePath = path.join(staticSourceDir, file);
        const targetPath = path.join(propertyDir, file);
        await fs.copy(sourcePath, targetPath);
        
        this.logger.debug(`Copied static asset: ${file}`);
      }
    }

    // Copy images subdirectory if it exists
    const imagesSourceDir = path.join(this.templatesPath, 'assets', 'images');
    const imagesTargetDir = path.join(propertyDir, 'images');

    if (await fs.pathExists(imagesSourceDir)) {
      await fs.ensureDir(imagesTargetDir);
      await fs.copy(imagesSourceDir, imagesTargetDir);
      
      this.logger.debug(`Copied image assets to images/`);
    }

    // Copy icons subdirectory if it exists
    const iconsSourceDir = path.join(this.templatesPath, 'assets', 'icons');
    const iconsTargetDir = path.join(propertyDir, 'icons');

    if (await fs.pathExists(iconsSourceDir)) {
      await fs.ensureDir(iconsTargetDir);
      await fs.copy(iconsSourceDir, iconsTargetDir);
      
      this.logger.debug(`Copied icon assets to icons/`);
    }
  }

  async createManifest(outputDir: string, propertyId: string, propertyData: PropertyData): Promise<void> {
    const propertyDir = path.join(outputDir, propertyId);
    const manifestPath = path.join(propertyDir, 'manifest.json');

    const manifest = {
      propertyId,
      generatedAt: new Date().toISOString(),
      generator: '@elephant/fact-sheet',
      version: '1.0.0',
      domain: this.options.domain || 'https://elephant.xyz/homes/public',
      options: {
        inlineCss: this.options.inlineCss || false,
        inlineJs: this.options.inlineJs || false
      },
      property: {
        address: propertyData.address,
        details: propertyData.property,
        salesCount: propertyData.all_sales?.length || 0,
        taxCount: propertyData.all_taxes?.length || 0,
        dataSourcesCount: propertyData.data_sources?.length || 0
      }
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    
    this.logger.debug(`Created manifest.json for ${propertyId}`);
  }

  async optimizeAssets(_outputDir: string, _propertyId: string): Promise<void> {
    // Future: Add asset optimization (minification, compression, etc.)
    this.logger.debug(`Asset optimization not yet implemented`);
  }

  private async copyPropertyImages(propertyDir: string, propertyDataPath: string, propertyData: PropertyData): Promise<void> {
    // Only copy images that are referenced in carousel_images
    if (await fs.pathExists(propertyDataPath) && propertyData.carousel_images) {
      for (const image of propertyData.carousel_images) {
        // Extract filename from ipfs_url
        const filename = path.basename(image.ipfs_url);
        const sourcePath = path.join(propertyDataPath, filename);
        
        // Check if the image file exists
        if (await fs.pathExists(sourcePath)) {
          const targetPath = path.join(propertyDir, filename);
          await fs.copy(sourcePath, targetPath);
          
          this.logger.debug(`Copied carousel image: ${filename}`);
        }
      }
    }
  }
}