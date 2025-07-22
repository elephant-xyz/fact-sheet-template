import { glob } from "glob";
import path from "path";
import fs from "fs-extra";
import { Logger } from './logger.js';
export class DataLoader {
    logger;
    constructor(options) {
        this.logger = new Logger({
            quiet: options.quiet,
            verbose: options.verbose,
            ci: options.ci,
            logFile: options.logFile
        });
    }
    async loadPropertyData(inputDir) {
        const homes = {};
        const pattern = path.join(inputDir, "**/*.json");
        const files = await glob(pattern);
        this.logger.debug(`Found ${files.length} JSON files`);
        files.forEach((file) => {
            const relativePath = path.relative(inputDir, file);
            const dir = path.dirname(relativePath);
            if (dir === '.')
                return;
            const propertyId = dir.split(path.sep)[0];
            if (!homes[propertyId]) {
                homes[propertyId] = {};
            }
            const filename = path.basename(file, ".json");
            try {
                const data = JSON.parse(fs.readFileSync(file, "utf8"));
                homes[propertyId][filename] = data;
            }
            catch (error) {
                this.logger.warn(`Failed to parse ${file}: ${error.message}`, {
                    file,
                    error: error.message
                });
            }
        });
        for (const propertyId of Object.keys(homes)) {
            await this.processPropertyData(propertyId, homes[propertyId], files, inputDir);
        }
        this.logger.debug(`Loaded ${Object.keys(homes).length} properties`);
        return homes;
    }
    async processPropertyData(propertyId, propertyData, allFiles, inputDir) {
        const salesHistoryFiles = allFiles.filter((f) => {
            const relativePath = path.relative(inputDir, f);
            const dir = path.dirname(relativePath);
            const propertyDir = dir.split(path.sep)[0];
            return propertyDir === propertyId && path.basename(f).startsWith("sales_history_");
        });
        const sales_history = salesHistoryFiles.map((f) => {
            const d = JSON.parse(fs.readFileSync(f, "utf8"));
            return {
                date: d.ownership_transfer_date || d.sales_date,
                amount: parseFloat(d.purchase_price_amount || d.sales_transaction_amount || 0),
            };
        });
        sales_history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        propertyData.sales_history = sales_history;
        const allSales = [];
        Object.keys(propertyData).forEach((key) => {
            if (key.startsWith("sales_") && propertyData[key]) {
                const saleData = propertyData[key];
                let associatedEntity = null;
                Object.keys(propertyData).forEach((relKey) => {
                    if (relKey.startsWith("relationship_sales_person_") &&
                        propertyData[relKey]) {
                        const rel = propertyData[relKey];
                        if (rel.from && rel.from["/"] === `./${key}.json`) {
                            const personKey = rel.to["/"]
                                .replace("./", "")
                                .replace(".json", "");
                            if (propertyData[personKey]) {
                                const person = propertyData[personKey];
                                associatedEntity = {
                                    type: "person",
                                    name: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
                                    data: person,
                                };
                            }
                        }
                    }
                });
                Object.keys(propertyData).forEach((relKey) => {
                    if (relKey.startsWith("relationship_sales_company_") &&
                        propertyData[relKey]) {
                        const rel = propertyData[relKey];
                        if (rel.from && rel.from["/"] === `./${key}.json`) {
                            const companyKey = rel.to["/"]
                                .replace("./", "")
                                .replace(".json", "");
                            if (propertyData[companyKey]) {
                                const company = propertyData[companyKey];
                                associatedEntity = {
                                    type: "company",
                                    name: company.name,
                                    data: company,
                                };
                            }
                        }
                    }
                });
                allSales.push({
                    key: key,
                    data: saleData,
                    associatedEntity: associatedEntity,
                });
            }
        });
        propertyData.all_sales = allSales;
        const allTaxes = [];
        Object.keys(propertyData).forEach((key) => {
            if (key.startsWith("tax_") && propertyData[key]) {
                allTaxes.push({
                    key: key,
                    data: propertyData[key],
                });
            }
        });
        propertyData.all_taxes = allTaxes;
        const dataSources = [];
        if (propertyData.address && propertyData.address.source_http_request) {
            const request = propertyData.address.source_http_request;
            if (typeof request === "string") {
                const urlMatch = request.match(/GET\s+([^\s]+)/);
                const hostMatch = request.match(/Host:\s+([^\r\n]+)/);
                dataSources.push({
                    type: "Address",
                    url: urlMatch ? urlMatch[1] : null,
                    host: hostMatch ? hostMatch[1] : null,
                    full_request: request,
                    description: "Property address and location data",
                });
            }
        }
        for (let i = 1; i <= 5; i++) {
            const salesKey = `sales_${i}`;
            if (propertyData[salesKey] && propertyData[salesKey].source_http_request) {
                const request = propertyData[salesKey].source_http_request;
                if (typeof request === "string") {
                    const urlMatch = request.match(/GET\s+([^\s]+)/);
                    const hostMatch = request.match(/Host:\s+([^\r\n]+)/);
                    dataSources.push({
                        type: `Sales History ${i}`,
                        url: urlMatch ? urlMatch[1] : null,
                        host: hostMatch ? hostMatch[1] : null,
                        full_request: request,
                        description: `Property sales transaction data`,
                    });
                }
            }
        }
        for (let i = 1; i <= 5; i++) {
            const taxKey = `tax_${i}`;
            if (propertyData[taxKey] && propertyData[taxKey].source_http_request) {
                const request = propertyData[taxKey].source_http_request;
                if (typeof request === "string") {
                    const urlMatch = request.match(/GET\s+([^\s]+)/);
                    const hostMatch = request.match(/Host:\s+([^\r\n]+)/);
                    dataSources.push({
                        type: `Tax Information ${i}`,
                        url: urlMatch ? urlMatch[1] : null,
                        host: hostMatch ? hostMatch[1] : null,
                        full_request: request,
                        description: `Property tax assessment data`,
                    });
                }
            }
        }
        propertyData.data_sources = dataSources;
    }
}
//# sourceMappingURL=data-loader.js.map