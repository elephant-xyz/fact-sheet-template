import { glob } from "glob";
import path from "path";
import fs from "fs-extra";
import { Logger } from './logger.js';
import { BuilderOptions, PropertyData, SalesHistoryEntry, SalesEntry, TaxEntry, DataSource } from '../types/property.js';
import { IPLDDataLoader } from './ipld-data-loader.js';

export class DataLoader {
  private logger: Logger;
  private ipldLoader: IPLDDataLoader;

  constructor(options: BuilderOptions) {
    this.logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: options.ci,
      logFile: options.logFile
    });
    this.ipldLoader = new IPLDDataLoader(options.input);
  }

  async loadPropertyData(inputDir: string): Promise<Record<string, PropertyData>> {
    const homes: Record<string, any> = {};
    
    // Check if we should use IPLD loader (directories are CIDs)
    const directories = await fs.readdir(inputDir);
    const useIPLD = directories.some(dir => this.isCID(dir));
    
    if (useIPLD) {
      this.logger.info('Detected IPLD structure, using IPLD data loader');
      
      // Load each property using IPLD loader
      for (const dir of directories) {
        const dirPath = path.join(inputDir, dir);
        const stats = await fs.stat(dirPath);
        
        if (stats.isDirectory()) {
          try {
            const propertyData = await this.ipldLoader.loadPropertyData(dir);
            homes[dir] = this.transformIPLDData(propertyData);
          } catch (error) {
            this.logger.warn(`Failed to load IPLD data for ${dir}: ${(error as Error).message}`);
          }
        }
      }
      
      return homes as Record<string, PropertyData>;
    }
    
    // Fall back to original loading logic
    this.logger.info('Using traditional data loader');
    
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
      
      // Handle seed data format
      if (homes[propertyId].property_seed && homes[propertyId].unnormalized_address) {
        this.processSeedData(propertyId, homes[propertyId]);
      }
    }

    this.logger.debug(`Loaded ${Object.keys(homes).length} properties`);

    return homes as Record<string, PropertyData>;
  }
  
  private processSeedData(propertyId: string, propertyData: any): void {
    // Extract data from seed format
    const seedData = propertyData.property_seed || {};
    const unnormalizedAddress = propertyData.unnormalized_address || {};
    
    // Parse the unnormalized address
    const fullAddress = unnormalizedAddress.full_address || '';
    const addressParts = fullAddress.split(',').map((s: string) => s.trim());
    
    // Extract city, state, zip from address
    let streetAddress = '';
    let city = '';
    let state = '';
    let zip = '';
    
    if (addressParts.length >= 3) {
      // Assume format: "street, city, state zip"
      streetAddress = addressParts[0];
      city = addressParts[1] || '';
      const stateZip = addressParts[2].split(' ');
      state = stateZip[0] || '';
      zip = stateZip[1] || '';
    }
    
    // Parse street address components
    const streetParts = streetAddress.split(' ');
    let streetNumber = '';
    let streetName = '';
    let streetSuffix = '';
    
    if (streetParts.length > 0) {
      // First part is usually the number
      if (/^\d+/.test(streetParts[0])) {
        streetNumber = streetParts[0];
        // Last part is often the suffix (Rd, St, Ave, etc.)
        if (streetParts.length > 2) {
          streetSuffix = streetParts[streetParts.length - 1];
          streetName = streetParts.slice(1, -1).join(' ');
        } else if (streetParts.length === 2) {
          streetName = streetParts[1];
        }
      } else {
        streetName = streetAddress;
      }
    }
    
    // Create normalized address structure
    if (!propertyData.address) {
      propertyData.address = {};
    }
    
    propertyData.address = {
      ...propertyData.address,
      full_address: fullAddress,
      street_address: streetAddress,
      street_number: streetNumber,
      street_name: streetName,
      street_suffix_type: streetSuffix,
      city_name: city,
      state_code: state.toUpperCase(),
      zip_code: zip,
      county_name: this.capitalizeWords(unnormalizedAddress.county_jurisdiction) || '',
      source_http_request: unnormalizedAddress.source_http_request
    };
    
    // Create property structure with parcel ID
    if (!propertyData.property) {
      propertyData.property = {};
    }
    
    propertyData.property = {
      ...propertyData.property,
      parcel_identifier: seedData.parcel_id || seedData.request_identifier || propertyId,
      request_identifier: seedData.request_identifier || propertyId,
      source_http_request: seedData.source_http_request
    };
    
    // Create minimal building structure
    if (!propertyData.building) {
      propertyData.building = {
        property_type: 'Property',
        bedrooms: 0,
        bathrooms: 0
      };
    }
    
    // Ensure required arrays exist
    if (!propertyData.sales_history) {
      propertyData.sales_history = [];
    }
    if (!propertyData.all_sales) {
      propertyData.all_sales = [];
    }
    if (!propertyData.all_taxes) {
      propertyData.all_taxes = [];
    }
    if (!propertyData.data_sources) {
      propertyData.data_sources = [];
    }
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

  private isCID(str: string): boolean {
    // Basic check for CID format (starts with 'baf' and has appropriate length)
    return str.startsWith('baf') && str.length > 40;
  }
  
  private capitalizeWords(str?: string): string {
    if (!str) return '';
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  private transformIPLDData(ipldData: any): PropertyData {
    // Transform IPLD data structure to match existing PropertyData format
    const property = ipldData.property || {};
    const sales = ipldData.sales || [];
    const taxes = ipldData.taxes || [];
    
    // Create the expected structure
    const transformed: any = {
      property: {
        livable_floor_area: property.sqft?.toString() || '',
        property_type: property.type || '',
        property_structure_built_year: property.yearBuilt || 0,
        parcel_identifier: property.parcelId || '',
        property_legal_description_text: property.legalDescription || ''
      },
      address: {
        street_address: property.address || '',
        street_number: property.address?.split(' ')[0] || '',
        street_name: property.address?.split(' ').slice(1, -1).join(' ') || '',
        street_suffix_type: property.address?.split(' ').slice(-1)[0] || '',
        city_name: property.city || '',
        state_code: property.state || '',
        county_name: property.county || '',
        latitude: property.coordinates?.split(',')[0]?.trim() || '',
        longitude: property.coordinates?.split(',')[1]?.trim() || ''
      },
      building: {
        bedrooms: property.beds || 0,
        bathrooms: property.baths || 0,
        property_type: property.type || '',
        year_built: property.yearBuilt || 0,
        living_area: property.sqft || 0
      },
      lot: {
        lot_size_sqft: property.lotArea?.replace(' sqft', '') || '',
        lot_type: property.lotType || ''
      },
      sales_history: sales.map((sale: any) => ({
        date: sale.date,
        amount: sale.price
      })),
      all_sales: sales.map((sale: any, _index: number) => ({
        key: `sales_${_index + 1}`,
        data: {
          ownership_transfer_date: sale.date,
          purchase_price_amount: sale.price
        },
        associatedEntity: sale.owner ? {
          type: 'person' as const,
          name: sale.owner,
          data: { person_name: sale.owner }
        } : null
      })),
      all_taxes: taxes.map((tax: any) => ({
        key: `tax_${tax.year}`,
        data: {
          property_assessed_value_amount: tax.value,
          property_taxable_value_amount: tax.value,
          tax_year: tax.year
        }
      })),
      features: ipldData.features || { interior: [], exterior: [] },
      structure: ipldData.structure || null,
      utility: ipldData.utility || null
    };
    
    return transformed as PropertyData;
  }
}