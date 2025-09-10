import { BuilderOptions, TemplateData } from '../types/property.js';
export declare class TemplateRenderer {
    private options;
    private env;
    private minifier;
    private svgCache;
    constructor(options: BuilderOptions);
    clearSvgCache(): void;
    private removeProblemMasks;
    private loadSvgContent;
    private setupFilters;
    renderProperty(propertyId: string, propertyData: TemplateData): Promise<string>;
}
//# sourceMappingURL=template-renderer.d.ts.map