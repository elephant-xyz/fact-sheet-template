#!/usr/bin/env node

import { Command } from 'commander';
import { Builder } from '../lib/builder.js';
import { DevServer } from '../lib/dev-server.js';
import { ConfigLoader } from '../lib/config-loader.js';
import { resolve } from 'path';
import fs from 'fs-extra';
import { Logger } from '../lib/logger.js';

const program = new Command();

program
  .name('fact-sheet')
  .description('Generate self-contained property fact sheet websites from JSON data')
  .version('1.0.0');

// Generate command
program
  .command('generate')
  .description('Generate property fact sheet websites from JSON data')
  .option('-i, --input <dir>', 'Input directory with property data')
  .option('-o, --output <dir>', 'Output directory for generated websites')
  .option('-d, --domain <url>', 'Domain for static assets')
  .option('--inline-css', 'Inline all CSS into HTML')
  .option('--inline-js', 'Inline all JavaScript into HTML')
  .option('-v, --verbose', 'Verbose output')
  .option('-q, --quiet', 'Suppress output except errors')
  .option('--ci', 'CI mode (non-interactive, structured output)')
  .option('--log-file <path>', 'Path to log file (default: fact-sheet-build.log)')
  .option('--no-log-file', 'Disable log file generation')
  .action(async (options) => {
    // Load config file
    const configLoader = new ConfigLoader();
    const config = await configLoader.loadConfig();
    options = configLoader.mergeWithCLIOptions(config, options);

    // Create logger for CLI
    const logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: options.ci,
      logFile: options.logFile
    });

    try {
      // Validate required options
      if (!options.input || !options.output) {
        logger.error('Input and output directories are required. Use -i and -o options or set in config file.');
        logger.finalize();
        process.exit(1);
      }

      // Validate input directory exists
      if (!await fs.pathExists(options.input)) {
        logger.error(`Input directory does not exist: ${options.input}`);
        logger.finalize();
        process.exit(1);
      }

      // Ensure output directory exists
      await fs.ensureDir(options.output);

      // Resolve paths to absolute
      options.input = resolve(options.input);
      options.output = resolve(options.output);

      logger.debug('Configuration:', {
        input: options.input,
        output: options.output,
        domain: options.domain,
        inlineCss: options.inlineCss || false,
        inlineJs: options.inlineJs || false
      });

      const builder = new Builder(options);
      await builder.build();

    } catch (error) {
      logger.error(`Build failed: ${error.message}`, {
        error: error.stack
      });
      logger.finalize();
      process.exit(1);
    }
  });

// Dev command
program
  .command('dev')
  .description('Start development server with live reload')
  .option('-i, --input <dir>', 'Input directory with property data')
  .option('-p, --port <number>', 'Port for development server')
  .option('--no-open', 'Do not open browser automatically')
  .option('--no-reload', 'Disable live reload')
  .option('-v, --verbose', 'Verbose output')
  .option('-q, --quiet', 'Suppress output except errors')
  .action(async (options) => {
    try {
      // Load config file
      const configLoader = new ConfigLoader();
      const config = await configLoader.loadConfig();
      options = configLoader.mergeWithCLIOptions(config, options);

      // Validate input directory exists
      if (!options.input) {
        console.error('Input directory is required. Use -i option or set in config file.');
        process.exit(1);
      }

      if (!await fs.pathExists(options.input)) {
        console.error(`Input directory does not exist: ${options.input}`);
        process.exit(1);
      }

      // Resolve paths to absolute
      options.input = resolve(options.input);
      options.output = resolve('.elephant-dev'); // Temporary output for dev
      if (options.port) {
        options.port = parseInt(options.port, 10);
      }

      const devServer = new DevServer(options);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nShutting down development server...');
        await devServer.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        await devServer.stop();
        process.exit(0);
      });

      await devServer.start();

    } catch (error) {
      console.error('Dev server failed:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize a new fact-sheet project with config file')
  .action(async () => {
    try {
      const configLoader = new ConfigLoader();
      const existingConfig = await configLoader.loadConfig();
      
      if (existingConfig) {
        console.log('Config file already exists.');
        return;
      }
      
      await configLoader.createDefaultConfig();
      console.log('Created .factsheetrc.json with default configuration.');
      console.log('Edit this file to customize your project settings.');
      
    } catch (error) {
      console.error('Failed to create config file:', error.message);
      process.exit(1);
    }
  });

// Add help command
program
  .command('help [command]')
  .description('Display help for command')
  .action((command) => {
    if (command) {
      program.commands.find(cmd => cmd.name() === command)?.help();
    } else {
      program.help();
    }
  });

program.parse();