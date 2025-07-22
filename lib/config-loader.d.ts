export interface FactSheetConfig {
    input?: string;
    output?: string;
    dev?: {
        port?: number;
        open?: boolean;
        reload?: boolean;
        verbose?: boolean;
    };
    build?: {
        domain?: string;
        inlineCss?: boolean;
        inlineJs?: boolean;
    };
}
export declare class ConfigLoader {
    private configFiles;
    loadConfig(cwd?: string): Promise<FactSheetConfig | null>;
    mergeWithCLIOptions(config: FactSheetConfig | null, cliOptions: any): any;
    createDefaultConfig(cwd?: string): Promise<void>;
}
//# sourceMappingURL=config-loader.d.ts.map