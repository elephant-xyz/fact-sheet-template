import { BuilderOptions, PropertyData } from '../types/property.js';
export declare class AssetManager {
    private options;
    private templatesPath;
    private logger;
    constructor(options: BuilderOptions);
    copyAssets(outputDir: string, propertyId: string): Promise<void>;
    private copyCSSAssets;
    private copyJSAssets;
    private copyStaticAssets;
    createManifest(outputDir: string, propertyId: string, propertyData: PropertyData): Promise<void>;
    optimizeAssets(_outputDir: string, _propertyId: string): Promise<void>;
}
//# sourceMappingURL=asset-manager.d.ts.map