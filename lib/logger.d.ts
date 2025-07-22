import { LoggerOptions } from '../types/property';
export declare class Logger {
    private quiet;
    private verbose;
    private ci;
    private logFile;
    private logEntries;
    private startTime;
    constructor(options?: LoggerOptions);
    private formatMessage;
    private writeToFile;
    private consoleOutput;
    info(message: string, data?: Record<string, any>): void;
    warn(message: string, data?: Record<string, any>): void;
    error(message: string, data?: Record<string, any>): void;
    success(message: string, data?: Record<string, any>): void;
    debug(message: string, data?: Record<string, any>): void;
    progress(current: number, total: number, message: string): void;
    section(title: string): void;
    finalize(): void;
}
//# sourceMappingURL=logger.d.ts.map