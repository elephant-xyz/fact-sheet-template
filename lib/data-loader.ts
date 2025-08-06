import path from "path";
import fs from "fs-extra";
import { Logger } from "./logger.js";
import { BuilderOptions, PropertyData } from "../types/property.js";
import { IPLDDataLoader } from "./ipld-data-loader.js";

export class DataLoader {
  private logger: Logger;
  private ipldLoader: IPLDDataLoader;

  constructor(options: BuilderOptions) {
    this.logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: options.ci,
      logFile: options.logFile,
    });
    this.ipldLoader = new IPLDDataLoader(options.input);
  }

  async loadPropertyData(
    inputDir: string,
  ): Promise<Record<string, PropertyData>> {
    const homes: Record<string, any> = {};

    const directories = await fs.readdir(inputDir);
    this.logger.info("Using IPLD data loader");

    for (const dir of directories) {
      const dirPath = path.join(inputDir, dir);
      const stats = await fs.stat(dirPath);

      if (stats.isDirectory()) {
        try {
          const propertyData = await this.ipldLoader.loadPropertyData(dir);
          homes[dir] = this.transformIPLDData(propertyData);
        } catch (error) {
          this.logger.warn(
            `Failed to load IPLD data for ${dir}: ${(error as Error).stack}`,
          );
        }
      }
    }

    return homes as Record<string, PropertyData>;
  }

  private transformIPLDData(ipldData: any): PropertyData {
    // Transform IPLD data structure to match existing PropertyData format
    const property = ipldData.property || {};
    const sales = ipldData.sales || [];
    const taxes = ipldData.taxes || [];

    // Create the expected structure
    const transformed: any = {
      property: {
        livable_floor_area: property.sqft?.toString() || "",
        property_type: property.type || "",
        property_structure_built_year: property.yearBuilt || 0,
        parcel_identifier: property.parcelId || "",
        property_legal_description_text: property.legalDescription || "",
        sourceUrl: property.sourceUrl || "",
      },
      address: {
        street_address: property.address || "",
        street_number: property.address?.split(" ")[0] || "",
        street_name: property.address?.split(" ").slice(1, -1).join(" ") || "",
        street_suffix_type: property.address?.split(" ").slice(-1)[0] || "",
        route_number: ipldData.address?.route_number || "",
        city_name: property.city || "",
        state_code: property.state || "",
        county_name: property.county || "",
        postal_code: property.postalCode || "",
        latitude: property.coordinates?.split(",")[0]?.trim() || "",
        longitude: property.coordinates?.split(",")[1]?.trim() || "",
        source_http_request: ipldData.address?.source_http_request || null,
      },
      building: {
        bedrooms: property.beds || 0,
        bathrooms: property.baths || 0,
        property_type: property.type || "",
        year_built: property.yearBuilt || 0,
        living_area: property.sqft || 0,
      },
      lot: {
        lot_size_sqft:
          typeof property.lotArea === "string"
            ? property.lotArea.replace(" sqft", "")
            : property.lotArea || "",
        lot_type: property.lotType || "",
      },
      sales_history: sales.map((sale: any) => ({
        date: sale.date,
        amount: sale.price,
      })),
      all_sales: sales.map((sale: any, _index: number) => ({
        key: `sales_${_index + 1}`,
        data: {
          ownership_transfer_date: sale.date,
          purchase_price_amount: sale.price,
          source_http_request: sale.source_http_request || null,
        },
        associatedEntity: sale.owner
          ? {
              type: "person" as const,
              name: sale.owner,
              data: { person_name: sale.owner },
            }
          : null,
      })),
      all_taxes: taxes.map((tax: any) => ({
        key: `tax_${tax.year}`,
        data: {
          property_assessed_value_amount: tax.value,
          property_taxable_value_amount: tax.value,
          tax_year: tax.year,
          source_http_request: tax.source_http_request || null,
        },
      })),
      features: ipldData.features || { interior: [], exterior: [] },
      structure: ipldData.structure || null,
      utility: ipldData.utility || null,

      carousel_images: ipldData.carousel_images || [],
      layouts: ipldData.layouts ? {
        ...ipldData.layouts,
        source_http_request: ipldData.layouts.source_http_request || null,
      } : [],
      sectionVisibility: ipldData.sectionVisibility || null,
      dataLabel: ipldData.dataLabel || null,
    };

    return transformed as PropertyData;
  }
}
