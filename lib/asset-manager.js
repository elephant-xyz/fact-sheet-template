import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Logger } from './logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class AssetManager {
    options;
    templatesPath;
    logger;
    constructor(options) {
        this.options = options;
        this.templatesPath = path.join(__dirname, '..', 'templates');
        this.logger = new Logger({
            quiet: options.quiet,
            verbose: options.verbose,
            ci: options.ci,
            logFile: options.logFile
        });
    }
    async copyAssets(outputDir, propertyId) {
        const propertyDir = path.join(outputDir, propertyId);
        this.logger.debug(`Copying assets for ${propertyId}...`);
        if (!this.options.inlineCss) {
            await this.copyCSSAssets(propertyDir);
        }
        if (!this.options.inlineJs) {
            await this.copyJSAssets(propertyDir);
        }
        await this.copyStaticAssets(propertyDir);
    }
    async copyCSSAssets(propertyDir) {
        const cssSourceDir = path.join(this.templatesPath, 'assets', 'css');
        const cssTargetDir = path.join(propertyDir, 'css');
        if (await fs.pathExists(cssSourceDir)) {
            await fs.ensureDir(cssTargetDir);
            await fs.copy(cssSourceDir, cssTargetDir);
            this.logger.debug(`Copied CSS assets to css/`);
        }
    }
    async copyJSAssets(propertyDir) {
        const jsSourceDir = path.join(this.templatesPath, 'assets', 'js');
        const jsTargetDir = path.join(propertyDir, 'js');
        if (await fs.pathExists(jsSourceDir)) {
            await fs.ensureDir(jsTargetDir);
            await fs.copy(jsSourceDir, jsTargetDir);
            this.logger.debug(`Copied JS assets to js/`);
        }
    }
    async copyStaticAssets(propertyDir) {
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
        const imagesSourceDir = path.join(this.templatesPath, 'assets', 'images');
        const imagesTargetDir = path.join(propertyDir, 'images');
        if (await fs.pathExists(imagesSourceDir)) {
            await fs.ensureDir(imagesTargetDir);
            await fs.copy(imagesSourceDir, imagesTargetDir);
            this.logger.debug(`Copied image assets to images/`);
        }
        const iconsSourceDir = path.join(this.templatesPath, 'assets', 'icons');
        const iconsTargetDir = path.join(propertyDir, 'icons');
        if (await fs.pathExists(iconsSourceDir)) {
            await fs.ensureDir(iconsTargetDir);
            await fs.copy(iconsSourceDir, iconsTargetDir);
            this.logger.debug(`Copied icon assets to icons/`);
        }
    }
    async createManifest(outputDir, propertyId, propertyData) {
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
    async optimizeAssets(_outputDir, _propertyId) {
        this.logger.debug(`Asset optimization not yet implemented`);
    }
}
//# sourceMappingURL=asset-manager.js.map