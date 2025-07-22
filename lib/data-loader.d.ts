import { BuilderOptions, PropertyData } from '../types/property.js';
export declare class DataLoader {
    private logger;
    constructor(options: BuilderOptions);
    loadPropertyData(inputDir: string): Promise<Record<string, PropertyData>>;
    private processPropertyData;
}
//# sourceMappingURL=data-loader.d.ts.map