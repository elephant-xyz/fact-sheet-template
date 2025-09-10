import { Logger } from './logger.js';
export declare class Minifier {
    private logger;
    private enabled;
    constructor(enabled: boolean, logger: Logger);
    minifyHTML(html: string): Promise<string>;
    minifyCSS(css: string, from?: string): Promise<string>;
    minifyJS(js: string, filename?: string): Promise<string>;
}
//# sourceMappingURL=minifier.d.ts.map