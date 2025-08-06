import path from "path";
import fs from "fs-extra";
import { Logger } from "./logger.js";
import { BuilderOptions, PropertyData } from "../types/property.js";
import { IPLDDataLoader } from "./ipld-data-loader.js";
import { JsonSchema } from "../types/schema.js";
import { CID } from 'multiformats/cid'
import { existsSync, PathLike } from "fs";

export class DataLoader {
  private logger: Logger;
  private ipldLoader: IPLDDataLoader;
  private dataDir: string
  private fsReadCache: Record<string, any>

  constructor(options: BuilderOptions) {
    this.logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: options.ci,
      logFile: options.logFile,
    });
    this.dataDir = options.input;
    this.ipldLoader = new IPLDDataLoader(options.input);
    this.fsReadCache = {};
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
          homes[dir].flattenedData = await this.flattenData(dir);
        } catch (error) {
          this.logger.warn(
            `Failed to load IPLD data for ${dir}: ${(error as Error).stack}`,
          );
        }
      }
    }

    return homes as Record<string, PropertyData>;
  }

  private async flattenData(rootCID: string): Promise<Record<string, any>> {
    const rootDir = path.join(this.dataDir, rootCID);
    if (!existsSync(rootDir)) {
      throw new Error(`Root directory not found: ${rootDir}`);
    }
    const files = await fs.readdir(rootDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const result: Record<string, any> = {};
    const validFiles = jsonFiles.filter(file => {
      const cid = path.basename(file, ".json");
      try {
        CID.parse(cid);
        return true;
      } catch {
        return false;
      }
    });

    await Promise.all(validFiles.map(async (file) => {
      const cid = path.basename(file, ".json");
      const parsedCid = CID.parse(cid);
      const label = await this.getGroupTitle(parsedCid);
      const content = await fs.readFile(path.join(rootDir.toString(), file.toString()), "utf-8");
      const data = JSON.parse(content);
      result[label] = await this.traverseLinkedData(data, rootDir);
    }))

    // for (const file of jsonFiles) {
    //   const cid = path.basename(file, ".json");
    //   let parsedCid;
    //   try {
    //     parsedCid = CID.parse(cid);
    //   }
    //   catch {
    //     continue;
    //   }
    //   const label = await this.getGroupTitle(parsedCid);
    //   const content = await fs.readFile(path.join(rootDir.toString(), file.toString()), "utf-8");
    //   const data = JSON.parse(content);
    //   result[label] = await this.traverseLinkedData(data, rootDir);
    // }
    return result
  }

  private async traverseLinkedData(data: any, baseDir: PathLike): Promise<any> {
    if ((data !== null) && (typeof data === "object") && (Object.hasOwn(data, "/"))) {
      const contentData = await this.readJSONWithCache(path.join(baseDir.toString(), data["/"].toString()));
      return this.traverseLinkedData(contentData, baseDir);
    }
    else if ((data !== null) && (typeof data === "object")) {
      for (const key in data) {
        data[key] = await this.traverseLinkedData(data[key], baseDir);
      }
    }
    else if (Array.isArray(data)) {
      return data.map((i: any) => { this.traverseLinkedData(i, baseDir) })
    }
    return data;
  }

  private async readJSONWithCache(path: PathLike): Promise<any> {
    if (Object.hasOwn(this.fsReadCache, path.toString())) {
      return this.fsReadCache[path.toString()]
    }
    const content = await fs.readFile(path, "utf-8");
    const data = JSON.parse(content);
    this.fsReadCache[path.toString()] = data;
    return data
  }

  private async getGroupTitle(groupCID: CID): Promise<string> {
    const content = JSON.parse(await this.fetchIPFSContent(groupCID)) as JsonSchema;
    return content.title;
  }

  private async fetchIPFSContent(cid: CID): Promise<any> {
    return await (await fetch(`https://ipfs.io/ipfs/${cid.toString()}`)).text();
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
