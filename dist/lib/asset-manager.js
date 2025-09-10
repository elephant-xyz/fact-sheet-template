import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Logger } from './logger.js';
import { Minifier } from './minifier.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class AssetManager {
    options;
    templatesPath;
    logger;
    minifier;
    constructor(options) {
        this.options = options;
        this.templatesPath = path.join(__dirname, '..', '..', 'templates');
        this.logger = new Logger({
            quiet: options.quiet,
            verbose: options.verbose,
            ci: options.ci,
            logFile: options.logFile,
        });
        this.minifier = new Minifier(options.minify || false, this.logger);
    }
    async copyAssets(outputDir, propertyId, propertyDataPath, propertyData) {
        const propertyDir = path.join(outputDir, propertyId);
        this.logger.debug(`Copying assets for ${propertyId}...`);
        if (!this.options.inlineCss) {
            await this.copyCSSAssets(propertyDir);
        }
        if (!this.options.inlineJs) {
            await this.copyJSAssets(propertyDir);
        }
        await this.copyStaticAssets(propertyDir);
        if (propertyDataPath && propertyData) {
            await this.copyPropertyImages(propertyDir, propertyDataPath, propertyData);
        }
    }
    async copyCSSAssets(propertyDir) {
        const cssSourceDir = path.join(this.templatesPath, 'assets', 'css');
        const cssTargetDir = path.join(propertyDir, 'css');
        if (await fs.pathExists(cssSourceDir)) {
            await fs.ensureDir(cssTargetDir);
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
                }
                else {
                    await fs.copy(path.join(cssSourceDir, file), path.join(cssTargetDir, file));
                }
            }
            this.logger.debug(`Copied CSS assets to css/`);
        }
    }
    async copyJSAssets(propertyDir) {
        const jsSourceDir = path.join(this.templatesPath, 'assets', 'js');
        const jsTargetDir = path.join(propertyDir, 'js');
        if (await fs.pathExists(jsSourceDir)) {
            await fs.ensureDir(jsTargetDir);
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
                }
                else {
                    await fs.copy(path.join(jsSourceDir, file), path.join(jsTargetDir, file));
                }
            }
            this.logger.debug(`Copied JS assets to js/`);
        }
    }
    async copyStaticAssets(propertyDir) {
        const staticSourceDir = path.join(this.templatesPath, 'assets', 'static');
        if (await fs.pathExists(staticSourceDir)) {
            const files = await fs.readdir(staticSourceDir);
            for (const file of files) {
                const isFavicon = file.includes('favicon');
                const isLogo = file.includes('elephant_logo');
                if (this.options.inlineSvg && file.endsWith('.svg') && !isFavicon && !isLogo) {
                    this.logger.debug(`Skipping SVG file (will be inlined): ${file}`);
                    continue;
                }
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
    async optimizeAssets(_outputDir, _propertyId) {
        this.logger.debug(`Asset optimization not yet implemented`);
    }
    async copyPropertyImages(propertyDir, propertyDataPath, propertyData) {
        if ((await fs.pathExists(propertyDataPath)) && propertyData.carousel_images) {
            for (const image of propertyData.carousel_images) {
                const filename = path.basename(image.ipfs_url);
                const sourcePath = path.join(propertyDataPath, filename);
                if (await fs.pathExists(sourcePath)) {
                    const targetPath = path.join(propertyDir, filename);
                    await fs.copy(sourcePath, targetPath);
                    this.logger.debug(`Copied carousel image: ${filename}`);
                }
            }
        }
    }
}
//# sourceMappingURL=asset-manager.js.map