import { glob } from "glob";
import path from "path";
import fs from "fs-extra";
import { Logger } from './logger.js';
import { BuilderOptions, PropertyData, SalesHistoryEntry, SalesEntry, TaxEntry, DataSource } from '../types/property.js';

export class DataLoader {
  private logger: Logger;

  constructor(options: BuilderOptions) {
    this.logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: options.ci,
      logFile: options.logFile
    });
  }

  async loadPropertyData(inputDir: string): Promise<Record<string, PropertyData>> {
    const homes: Record<string, any> = {};
    
    // Find all JSON files in the input directory
    const pattern = path.join(inputDir, "**/*.json");
    const files = await glob(pattern);

    this.logger.debug(`Found ${files.length} JSON files`);

    // Group files by property directory
    files.forEach((file) => {
      const relativePath = path.relative(inputDir, file);
      const dir = path.dirname(relativePath);
      
      // Skip files in root directory
      if (dir === '.') return;
      
      const propertyId = dir.split(path.sep)[0]; // Get first directory level
      
      if (!homes[propertyId]) {
        homes[propertyId] = {};
      }
      
      const filename = path.basename(file, ".json");
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        homes[propertyId][filename] = data;
      } catch (error) {
        this.logger.warn(`Failed to parse ${file}: ${(error as Error).message}`, {
          file,
          error: (error as Error).message
        });
      }
    });

    // Process each property's data
    for (const propertyId of Object.keys(homes)) {
      await this.processPropertyData(propertyId, homes[propertyId], files, inputDir);
    }

    this.logger.debug(`Loaded ${Object.keys(homes).length} properties`);

    return homes as Record<string, PropertyData>;
  }

  private async processPropertyData(
    propertyId: string, 
    propertyData: any, 
    allFiles: string[], 
    inputDir: string
  ): Promise<void> {
    // Aggregate sales_history_*.json for each property
    const salesHistoryFiles = allFiles.filter(
      (f) => {
        const relativePath = path.relative(inputDir, f);
        const dir = path.dirname(relativePath);
        const propertyDir = dir.split(path.sep)[0];
        return propertyDir === propertyId && path.basename(f).startsWith("sales_history_");
      }
    );

    const sales_history: SalesHistoryEntry[] = salesHistoryFiles.map((f) => {
      const d = JSON.parse(fs.readFileSync(f, "utf8"));
      return {
        date: d.ownership_transfer_date || d.sales_date,
        amount: parseFloat(
          d.purchase_price_amount || d.sales_transaction_amount || 0,
        ),
      };
    });

    // Sort by date descending
    sales_history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    propertyData.sales_history = sales_history;

    // Collect all sales data dynamically
    const allSales: SalesEntry[] = [];
    Object.keys(propertyData).forEach((key) => {
      if (key.startsWith("sales_") && propertyData[key]) {
        const saleData = propertyData[key];

        // Look for associated person or company
        let associatedEntity = null;

        // Check for person relationships
        Object.keys(propertyData).forEach((relKey) => {
          if (
            relKey.startsWith("relationship_sales_person_") &&
            propertyData[relKey]
          ) {
            const rel = propertyData[relKey];
            if (rel.from && rel.from["/"] === `./${key}.json`) {
              const personKey = rel.to["/"]
                .replace("./", "")
                .replace(".json", "");
              if (propertyData[personKey]) {
                const person = propertyData[personKey];
                associatedEntity = {
                  type: "person" as const,
                  name: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
                  data: person,
                };
              }
            }
          }
        });

        // Check for company relationships
        Object.keys(propertyData).forEach((relKey) => {
          if (
            relKey.startsWith("relationship_sales_company_") &&
            propertyData[relKey]
          ) {
            const rel = propertyData[relKey];
            if (rel.from && rel.from["/"] === `./${key}.json`) {
              const companyKey = rel.to["/"]
                .replace("./", "")
                .replace(".json", "");
              if (propertyData[companyKey]) {
                const company = propertyData[companyKey];
                associatedEntity = {
                  type: "company" as const,
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

    // Collect all tax data dynamically
    const allTaxes: TaxEntry[] = [];
    Object.keys(propertyData).forEach((key) => {
      if (key.startsWith("tax_") && propertyData[key]) {
        allTaxes.push({
          key: key,
          data: propertyData[key],
        });
      }
    });
    propertyData.all_taxes = allTaxes;

    // Process data sources for each property
    const dataSources: DataSource[] = [];

    // Address data source
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

    // Sales data sources
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

    // Tax data sources
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

    // Add data sources to property
    propertyData.data_sources = dataSources;
  }
}