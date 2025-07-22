import fs from 'fs-extra';
import path from 'path';
export class ConfigLoader {
    configFiles = [
        '.factsheetrc.json',
        '.factsheetrc',
        'factsheet.config.json'
    ];
    async loadConfig(cwd = process.cwd()) {
        for (const configFile of this.configFiles) {
            const configPath = path.join(cwd, configFile);
            if (await fs.pathExists(configPath)) {
                try {
                    const config = await fs.readJson(configPath);
                    return config;
                }
                catch (error) {
                    console.error(`Error reading config file ${configFile}:`, error);
                }
            }
        }
        return null;
    }
    mergeWithCLIOptions(config, cliOptions) {
        if (!config)
            return cliOptions;
        const merged = { ...cliOptions };
        if (config.input && !cliOptions.input) {
            merged.input = config.input;
        }
        if (config.output && !cliOptions.output) {
            merged.output = config.output;
        }
        if (config.dev) {
            if (config.dev.port && !cliOptions.port) {
                merged.port = config.dev.port;
            }
            if (config.dev.open !== undefined && cliOptions.open === undefined) {
                merged.open = config.dev.open;
            }
            if (config.dev.reload !== undefined && cliOptions.reload === undefined) {
                merged.reload = config.dev.reload;
            }
            if (config.dev.verbose !== undefined && !cliOptions.verbose) {
                merged.verbose = config.dev.verbose;
            }
        }
        if (config.build) {
            if (config.build.domain && !cliOptions.domain) {
                merged.domain = config.build.domain;
            }
            if (config.build.inlineCss !== undefined && cliOptions.inlineCss === undefined) {
                merged.inlineCss = config.build.inlineCss;
            }
            if (config.build.inlineJs !== undefined && cliOptions.inlineJs === undefined) {
                merged.inlineJs = config.build.inlineJs;
            }
        }
        return merged;
    }
    async createDefaultConfig(cwd = process.cwd()) {
        const defaultConfig = {
            input: "./property-data",
            output: "./dist",
            dev: {
                port: 3000,
                open: true,
                reload: true,
                verbose: false
            },
            build: {
                domain: "https://elephant.xyz/homes/public",
                inlineCss: false,
                inlineJs: false
            }
        };
        const configPath = path.join(cwd, '.factsheetrc.json');
        await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
    }
}
//# sourceMappingURL=config-loader.js.map