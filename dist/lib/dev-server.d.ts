import { BuilderOptions } from '../types/property.js';
export interface DevServerOptions extends BuilderOptions {
    port?: number;
    open?: boolean;
    reload?: boolean;
}
export declare class DevServer {
    private options;
    private logger;
    private builder;
    private watcher?;
    private server?;
    private wss?;
    private clients;
    private isBuilding;
    private buildQueue;
    constructor(options: DevServerOptions);
    start(): Promise<void>;
    private initialBuild;
    private startHttpServer;
    private startWebSocketServer;
    private startFileWatcher;
    private handleFileChange;
    private processBuildQueue;
    private getAffectedProperties;
    private rebuildProperty;
    private copyChangedAssets;
    private reloadBrowsers;
    stop(): Promise<void>;
}
//# sourceMappingURL=dev-server.d.ts.map