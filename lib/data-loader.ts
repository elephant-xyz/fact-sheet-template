import path from "path";
import fs from "fs-extra";
import { Logger } from "./logger.js";
import { BuilderOptions, PropertyData } from "../types/property.js";
import { IPLDDataLoader } from "./ipld-data-loader.js";
import { FeatureMapper } from "./feature-mapper.js";

export class DataLoader {
  private logger: Logger;
  private ipldLoader: IPLDDataLoader;
  private featureMapper: FeatureMapper;

  constructor(options: BuilderOptions) {
    this.logger = new Logger({
      quiet: options.quiet,
      verbose: options.verbose,
      ci: options.ci,
      logFile: options.logFile,
    });
    this.ipldLoader = new IPLDDataLoader(options.input);
    this.featureMapper = new FeatureMapper();
  }

  async loadPropertyData(
    inputDir: string,
  ): Promise<Record<string, PropertyData>> {
    const homes: Record<string, any> = {};

    // Always use IPLD loader for all directories
    const directories = await fs.readdir(inputDir);
    this.logger.info("Using IPLD data loader");

    // Load each property using IPLD loader
    for (const dir of directories) {
      const dirPath = path.join(inputDir, dir);
      const stats = await fs.stat(dirPath);

      if (stats.isDirectory()) {
        try {
          const propertyData = await this.ipldLoader.loadPropertyData(dir);
          homes[dir] = this.transformIPLDData(propertyData);
        } catch (error) {
          this.logger.warn(
            `Failed to load IPLD data for ${dir}: ${(error as Error).message}`,
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
        city_name: property.city || "",
        state_code: property.state || "",
        county_name: property.county || "",
        latitude: property.coordinates?.split(",")[0]?.trim() || "",
        longitude: property.coordinates?.split(",")[1]?.trim() || "",
      },
      building: {
        bedrooms: property.beds || 0,
        bathrooms: property.baths || 0,
        property_type: property.type || "",
        year_built: property.yearBuilt || 0,
        living_area: property.sqft || 0,
      },
      lot: {
        lot_size_sqft: typeof property.lotArea === 'string' ? property.lotArea.replace(" sqft", "") : property.lotArea || "",
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
        },
      })),
      features: ipldData.features || { interior: [], exterior: [] },
      structure: ipldData.structure || null,
      utility: ipldData.utility || null,

      carousel_images: ipldData.carousel_images || [],
      layouts: ipldData.layouts || [],
      
      // Process all features dynamically
      processed_features: this.processAllFeatures(ipldData),
    };

    return transformed as PropertyData;
  }



  private processAllFeatures(ipldData: any): {
    interior: Array<{ property: string; value: string; info: any }>;
    exterior: Array<{ property: string; value: string; info: any }>;
    utility: Array<{ property: string; value: string; info: any }>;
  } {
    const interior: Array<{ property: string; value: string; info: any }> = [];
    const exterior: Array<{ property: string; value: string; info: any }> = [];
    const utility: Array<{ property: string; value: string; info: any }> = [];

    // Process structure features (interior/exterior)
    if (ipldData.structure) {
      const structure = ipldData.structure;
      
      // Interior features
      if (structure.flooring_material_primary && structure.flooring_material_primary !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('structure', 'flooring_material_primary', structure.flooring_material_primary);
        if (featureInfo) {
          interior.push({
            property: 'flooring_material_primary',
            value: structure.flooring_material_primary,
            info: featureInfo
          });
        }
      }
      
      if (structure.flooring_material_secondary && structure.flooring_material_secondary !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('structure', 'flooring_material_secondary', structure.flooring_material_secondary);
        if (featureInfo) {
          interior.push({
            property: 'flooring_material_secondary',
            value: structure.flooring_material_secondary,
            info: featureInfo
          });
        }
      }

      // Exterior features
      if (structure.exterior_wall_material_primary && structure.exterior_wall_material_primary !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('structure', 'exterior_wall_material_primary', structure.exterior_wall_material_primary);
        if (featureInfo) {
          exterior.push({
            property: 'exterior_wall_material_primary',
            value: structure.exterior_wall_material_primary,
            info: featureInfo
          });
        }
      }
      
      if (structure.roof_covering_material && structure.roof_covering_material !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('structure', 'roof_covering_material', structure.roof_covering_material);
        if (featureInfo) {
          exterior.push({
            property: 'roof_covering_material',
            value: structure.roof_covering_material,
            info: featureInfo
          });
        }
      }
    }

    // Process utility features
    if (ipldData.utility) {
      const utilityData = ipldData.utility;
      
      if (utilityData.cooling_system_type && utilityData.cooling_system_type !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'cooling_system_type', utilityData.cooling_system_type);
        if (featureInfo) {
          utility.push({
            property: 'cooling_system_type',
            value: utilityData.cooling_system_type,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.heating_system_type && utilityData.heating_system_type !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'heating_system_type', utilityData.heating_system_type);
        if (featureInfo) {
          utility.push({
            property: 'heating_system_type',
            value: utilityData.heating_system_type,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.hvac_condensing_unit_present && utilityData.hvac_condensing_unit_present !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'hvac_condensing_unit_present', utilityData.hvac_condensing_unit_present);
        if (featureInfo) {
          utility.push({
            property: 'hvac_condensing_unit_present',
            value: utilityData.hvac_condensing_unit_present,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.electrical_panel_capacity) {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'electric_panel_capacity', utilityData.electrical_panel_capacity);
        if (featureInfo) {
          utility.push({
            property: 'electrical_panel_capacity',
            value: utilityData.electrical_panel_capacity,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.electrical_wiring_type && utilityData.electrical_wiring_type !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'electrical_wiring_type', utilityData.electrical_wiring_type);
        if (featureInfo) {
          utility.push({
            property: 'electrical_wiring_type',
            value: utilityData.electrical_wiring_type,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.plumbing_system_type && utilityData.plumbing_system_type !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'plumbing_system_type', utilityData.plumbing_system_type);
        if (featureInfo) {
          utility.push({
            property: 'plumbing_system_type',
            value: utilityData.plumbing_system_type,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.water_source_type && utilityData.water_source_type !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'water_source_type', utilityData.water_source_type);
        if (featureInfo) {
          utility.push({
            property: 'water_source_type',
            value: utilityData.water_source_type,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.sewer_type && utilityData.sewer_type !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'sewer_type', utilityData.sewer_type);
        if (featureInfo) {
          utility.push({
            property: 'sewer_type',
            value: utilityData.sewer_type,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.solar_panel_present && utilityData.solar_panel_present !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'solar_panel_present', utilityData.solar_panel_present);
        if (featureInfo) {
          utility.push({
            property: 'solar_panel_present',
            value: utilityData.solar_panel_present,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.solar_panel_type && utilityData.solar_panel_type !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'solar_panel_type', utilityData.solar_panel_type);
        if (featureInfo) {
          utility.push({
            property: 'solar_panel_type',
            value: utilityData.solar_panel_type,
            info: featureInfo
          });
        }
      }
      
      if (utilityData.smart_home_features && utilityData.smart_home_features !== 'other') {
        const featureInfo = this.featureMapper.getFeatureInfo('utility', 'smart_home_features', utilityData.smart_home_features);
        if (featureInfo) {
          utility.push({
            property: 'smart_home_features',
            value: utilityData.smart_home_features,
            info: featureInfo
          });
        }
      }
    }

    return { interior, exterior, utility };
  }
}

