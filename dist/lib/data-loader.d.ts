import { BuilderOptions, TemplateData } from '../types/property.js';
export declare class DataLoader {
    private logger;
    private ipldLoader;
    private dataDir;
    private fsReadCache;
    constructor(options: BuilderOptions);
    loadPropertyData(inputDir: string): Promise<Record<string, TemplateData>>;
    private flattenData;
    private traverseLinkedData;
    private readJSONWithCache;
    private getGroupTitle;
    private fetchIPFSContent;
    private transformIPLDData;
}
//# sourceMappingURL=data-loader.d.ts.map