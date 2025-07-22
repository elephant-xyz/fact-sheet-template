import { DataLoader } from './data-loader.js';
import { TemplateRenderer } from './template-renderer.js';
import { AssetManager } from './asset-manager.js';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from './logger.js';
export class Builder {
    options;
    logger;
    dataLoader;
    renderer;
    assetManager;
    constructor(options) {
        this.options = options;
        this.logger = new Logger({
            quiet: options.quiet,
            verbose: options.verbose,
            ci: options.ci,
            logFile: options.logFile
        });
        this.dataLoader = new DataLoader(options);
        this.renderer = new TemplateRenderer(options);
        this.assetManager = new AssetManager(options);
    }
    async build() {
        const startTime = Date.now();
        this.logger.section('Build Process');
        this.logger.info(`Input: ${this.options.input}`);
        this.logger.info(`Output: ${this.options.output}`);
        try {
            this.logger.info('Loading property data...');
            const properties = await this.dataLoader.loadPropertyData(this.options.input);
            const propertyIds = Object.keys(properties);
            if (propertyIds.length === 0) {
                this.logger.warn('No properties found in input directory');
                return;
            }
            this.logger.success(`Found ${propertyIds.length} properties`);
            let successCount = 0;
            let errorCount = 0;
            for (const propertyId of propertyIds) {
                try {
                    await this.buildProperty(propertyId, properties[propertyId]);
                    successCount++;
                    this.logger.progress(successCount, propertyIds.length, 'Building properties');
                }
                catch (error) {
                    errorCount++;
                    this.logger.error(`Failed to build ${propertyId}: ${error.message}`, {
                        propertyId,
                        error: error.stack
                    });
                }
            }
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.section('Build Summary');
            this.logger.success(`Build completed in ${duration}s`);
            this.logger.info(`Successfully built: ${successCount} properties`);
            if (errorCount > 0) {
                this.logger.warn(`Failed: ${errorCount} properties`);
            }
            this.logger.info(`Output directory: ${this.options.output}`);
            this.logger.finalize();
        }
        catch (error) {
            this.logger.error(`Build process failed: ${error.message}`, {
                error: error.stack
            });
            this.logger.finalize();
            throw error;
        }
    }
    async buildProperty(propertyId, propertyData) {
        this.logger.debug(`Building ${propertyId}...`);
        const propertyOutputDir = path.join(this.options.output, propertyId);
        await fs.ensureDir(propertyOutputDir);
        const html = await this.renderer.renderProperty(propertyId, propertyData);
        const htmlPath = path.join(propertyOutputDir, 'index.html');
        await fs.writeFile(htmlPath, html, 'utf8');
        this.logger.debug(`Generated index.html for ${propertyId}`);
        await this.assetManager.copyAssets(this.options.output, propertyId);
        await this.assetManager.createManifest(this.options.output, propertyId, propertyData);
        this.logger.debug(`Completed ${propertyId}`);
    }
    async validateInput() {
        if (!await fs.pathExists(this.options.input)) {
            throw new Error(`Input directory does not exist: ${this.options.input}`);
        }
        const items = await fs.readdir(this.options.input);
        const directories = [];
        for (const item of items) {
            const itemPath = path.join(this.options.input, item);
            const stats = await fs.stat(itemPath);
            if (stats.isDirectory()) {
                directories.push(item);
            }
        }
        if (directories.length === 0) {
            throw new Error('No property directories found in input directory');
        }
        return directories;
    }
    async cleanup() {
        this.logger.debug('Cleaning up...');
    }
}
//# sourceMappingURL=builder.js.map