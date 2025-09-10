import { BuilderOptions, TemplateData } from '../types/property.js';
export declare class AssetManager {
    private options;
    private templatesPath;
    private logger;
    private minifier;
    constructor(options: BuilderOptions);
    copyAssets(outputDir: string, propertyId: string, propertyDataPath?: string, propertyData?: TemplateData): Promise<void>;
    private copyCSSAssets;
    private copyJSAssets;
    private copyStaticAssets;
    optimizeAssets(_outputDir: string, _propertyId: string): Promise<void>;
    private copyPropertyImages;
}
//# sourceMappingURL=asset-manager.d.ts.map