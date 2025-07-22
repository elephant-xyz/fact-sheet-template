import fs from 'fs';
import { LoggerOptions, LogEntry } from '../types/property';

export class Logger {
  private quiet: boolean;
  private verbose: boolean;
  private ci: boolean;
  private logFile: string | null;
  private logEntries: LogEntry[] = [];
  private startTime: number;

  constructor(options: LoggerOptions = {}) {
    this.quiet = options.quiet || false;
    this.verbose = options.verbose || false;
    this.ci = options.ci || false;
    this.logFile = options.logFile !== false ? (options.logFile || 'fact-sheet-build.log') : null;
    this.startTime = Date.now();
  }

  private formatMessage(level: LogEntry['level'], message: string, data: Record<string, any> = {}): LogEntry {
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

  private writeToFile(): void {
    if (!this.logFile) return;
    
    try {
      const logData = {
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        entries: this.logEntries
      };
      
      fs.writeFileSync(this.logFile, JSON.stringify(logData, null, 2));
    } catch (error) {
      // Silently fail if we can't write the log file
    }
  }

  private consoleOutput(level: LogEntry['level'], message: string): void {
    if (this.quiet && level !== 'error') return;
    
    const prefix: Record<LogEntry['level'], string> = {
      info: '[INFO]',
      warn: '[WARN]',
      error: '[ERROR]',
      success: '[SUCCESS]',
      debug: '[DEBUG]'
    };
    
    const output = this.ci ? `${prefix[level]} ${message}` : message;
    
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else if (level === 'debug' && this.verbose) {
      console.log(output);
    } else if (level !== 'debug') {
      console.log(output);
    }
  }

  info(message: string, data: Record<string, any> = {}): void {
    const entry = this.formatMessage('info', message, data);
    this.logEntries.push(entry);
    this.consoleOutput('info', message);
  }

  warn(message: string, data: Record<string, any> = {}): void {
    const entry = this.formatMessage('warn', message, data);
    this.logEntries.push(entry);
    this.consoleOutput('warn', message);
  }

  error(message: string, data: Record<string, any> = {}): void {
    const entry = this.formatMessage('error', message, data);
    this.logEntries.push(entry);
    this.consoleOutput('error', message);
  }

  success(message: string, data: Record<string, any> = {}): void {
    const entry = this.formatMessage('success', message, data);
    this.logEntries.push(entry);
    this.consoleOutput('success', message);
  }

  debug(message: string, data: Record<string, any> = {}): void {
    const entry = this.formatMessage('debug', message, data);
    this.logEntries.push(entry);
    this.consoleOutput('debug', message);
  }

  progress(current: number, total: number, message: string): void {
    if (this.quiet || this.ci) return;
    
    const percentage = Math.round((current / total) * 100);
    const progressMessage = `Progress: ${current}/${total} (${percentage}%) - ${message}`;
    
    // In non-CI mode, we could use process.stdout.write for updating progress
    // For now, just log it normally
    this.info(progressMessage, { current, total, percentage });
  }

  section(title: string): void {
    const separator = '-'.repeat(50);
    this.info('');
    this.info(separator);
    this.info(title);
    this.info(separator);
  }

  finalize(): void {
    this.writeToFile();
  }
}