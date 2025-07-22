import { BuilderOptions } from '../types/property.js';
export declare class Builder {
    private options;
    private logger;
    private dataLoader;
    private renderer;
    private assetManager;
    constructor(options: BuilderOptions);
    build(): Promise<void>;
    buildProperty(propertyId: string, propertyData: any): Promise<void>;
    validateInput(): Promise<string[]>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=builder.d.ts.map