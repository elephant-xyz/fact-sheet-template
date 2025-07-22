import fs from 'fs';
export class Logger {
    quiet;
    verbose;
    ci;
    logFile;
    logEntries = [];
    startTime;
    constructor(options = {}) {
        this.quiet = options.quiet || false;
        this.verbose = options.verbose || false;
        this.ci = options.ci || false;
        this.logFile = options.logFile !== false ? (options.logFile || 'fact-sheet-build.log') : null;
        this.startTime = Date.now();
    }
    formatMessage(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const elapsed = Date.now() - this.startTime;
        return {
            timestamp,
            elapsed,
            level,
            message,
            ...data
        };
    }
    writeToFile() {
        if (!this.logFile)
            return;
        try {
            const logData = {
                startTime: new Date(this.startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - this.startTime,
                entries: this.logEntries
            };
            fs.writeFileSync(this.logFile, JSON.stringify(logData, null, 2));
        }
        catch (error) {
        }
    }
    consoleOutput(level, message) {
        if (this.quiet && level !== 'error')
            return;
        const prefix = {
            info: '[INFO]',
            warn: '[WARN]',
            error: '[ERROR]',
            success: '[SUCCESS]',
            debug: '[DEBUG]'
        };
        const output = this.ci ? `${prefix[level]} ${message}` : message;
        if (level === 'error') {
            console.error(output);
        }
        else if (level === 'warn') {
            console.warn(output);
        }
        else if (level === 'debug' && this.verbose) {
            console.log(output);
        }
        else if (level !== 'debug') {
            console.log(output);
        }
    }
    info(message, data = {}) {
        const entry = this.formatMessage('info', message, data);
        this.logEntries.push(entry);
        this.consoleOutput('info', message);
    }
    warn(message, data = {}) {
        const entry = this.formatMessage('warn', message, data);
        this.logEntries.push(entry);
        this.consoleOutput('warn', message);
    }
    error(message, data = {}) {
        const entry = this.formatMessage('error', message, data);
        this.logEntries.push(entry);
        this.consoleOutput('error', message);
    }
    success(message, data = {}) {
        const entry = this.formatMessage('success', message, data);
        this.logEntries.push(entry);
        this.consoleOutput('success', message);
    }
    debug(message, data = {}) {
        const entry = this.formatMessage('debug', message, data);
        this.logEntries.push(entry);
        this.consoleOutput('debug', message);
    }
    progress(current, total, message) {
        if (this.quiet || this.ci)
            return;
        const percentage = Math.round((current / total) * 100);
        const progressMessage = `Progress: ${current}/${total} (${percentage}%) - ${message}`;
        this.info(progressMessage, { current, total, percentage });
    }
    section(title) {
        const separator = '-'.repeat(50);
        this.info('');
        this.info(separator);
        this.info(title);
        this.info(separator);
    }
    finalize() {
        this.writeToFile();
    }
}
//# sourceMappingURL=logger.js.map