import { BuilderOptions, PropertyData } from '../types/property.js';
export declare class TemplateRenderer {
    private options;
    private env;
    constructor(options: BuilderOptions);
    private setupFilters;
    renderProperty(propertyId: string, propertyData: PropertyData): Promise<string>;
}
//# sourceMappingURL=template-renderer.d.ts.map