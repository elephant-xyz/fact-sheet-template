import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DataMapping {
  lexiconClass: string;
  lexiconProperty: string;
  iconName: string;
  enumValue?: string;
  enumDescription?: string;
}

export interface FeatureInfo {
  iconName: string;
  description: string;
  displayText: string;
}

export class FeatureMapper {
  private dataMapping: DataMapping[] = [];
  private initialized: boolean = false;

  constructor() {
    // Initialize synchronously
    this.initialize();
  }

  private initialize(): void {
    try {
      const mappingPath = path.join(__dirname, 'data-mapping.json');
      const mappingData = fs.readJsonSync(mappingPath);
      this.dataMapping = mappingData;
      this.initialized = true;
    } catch (error) {
      console.warn('Could not load data-mapping.json:', error);
      this.dataMapping = [];
      this.initialized = true;
    }
  }

  /**
   * Check if the mapper is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get feature information for a property value
   */
  public getFeatureInfo(
    lexiconClass: string,
    lexiconProperty: string,
    value: string
  ): FeatureInfo | null {
    // Find exact match
    const exactMatch = this.dataMapping.find(
      mapping =>
        mapping.lexiconClass === lexiconClass &&
        mapping.lexiconProperty === lexiconProperty &&
        mapping.enumValue === value
    );

    if (exactMatch) {
      return {
        iconName: exactMatch.iconName,
        description: exactMatch.enumDescription || value,
        displayText: exactMatch.enumDescription || this.formatDisplayText(value)
      };
    }

    // Find partial match (property only)
    const partialMatch = this.dataMapping.find(
      mapping =>
        mapping.lexiconClass === lexiconClass &&
        mapping.lexiconProperty === lexiconProperty &&
        !mapping.enumValue // No specific enum value means it's a general property
    );

    if (partialMatch) {
      return {
        iconName: partialMatch.iconName,
        description: this.formatDisplayText(value),
        displayText: this.formatDisplayText(value)
      };
    }

    // No mapping found, return default
    return {
      iconName: 'default',
      description: this.formatDisplayText(value),
      displayText: this.formatDisplayText(value)
    };
  }

  /**
   * Get all available features for a property object
   */
  public getPropertyFeatures(propertyData: any): {
    interior: Array<{ property: string; value: string; info: FeatureInfo }>;
    exterior: Array<{ property: string; value: string; info: FeatureInfo }>;
  } {
    const interior: Array<{ property: string; value: string; info: FeatureInfo }> = [];
    const exterior: Array<{ property: string; value: string; info: FeatureInfo }> = [];

    // Structure features (interior)
    if (propertyData.structure) {
      const interiorProperties = [
        'flooring_material_primary',
        'flooring_material_secondary',
        'subfloor_material',
        'ceiling_height_average',
        'ceiling_structure_material',
        'ceiling_insulation_type',
        'interior_door_material',
        'window_frame_material',
        'window_glazing_type',
        'window_operation_type',
        'window_screen_material',
        'interior_wall_surface_material_primary',
        'interior_wall_finish_primary'
      ];

      interiorProperties.forEach(prop => {
        if (propertyData.structure[prop] && propertyData.structure[prop] !== 'other') {
          const info = this.getFeatureInfo('structure', prop, propertyData.structure[prop]);
          if (info) {
            interior.push({
              property: prop,
              value: propertyData.structure[prop],
              info
            });
          }
        }
      });
    }

    // Utility features (interior)
    if (propertyData.utility) {
      const utilityProperties = [
        'cooling_system_type',
        'heating_system_type',
        'hvac_condensing_unit_present',
        'hvac_unit_condition',
        'electrical_panel_capacity',
        'electrical_wiring_type',
        'plumbing_system_type',
        'smart_home_features'
      ];

      utilityProperties.forEach(prop => {
        if (propertyData.utility[prop] && propertyData.utility[prop] !== 'other') {
          const info = this.getFeatureInfo('utility', prop, propertyData.utility[prop]);
          if (info) {
            interior.push({
              property: prop,
              value: propertyData.utility[prop],
              info
            });
          }
        }
      });
    }

    // Structure features (exterior)
    if (propertyData.structure) {
      const exteriorProperties = [
        'exterior_wall_material_primary',
        'exterior_wall_material_secondary',
        'exterior_wall_insulation_type',
        'roof_covering_material',
        'roof_structure_material',
        'roof_design_type',
        'gutters_material',
        'foundation_type',
        'foundation_material',
        'foundation_waterproofing',
        'exterior_door_material',
        'architectural_style_type',
        'primary_framing_material',
        'secondary_framing_material'
      ];

      exteriorProperties.forEach(prop => {
        if (propertyData.structure[prop] && propertyData.structure[prop] !== 'other') {
          const info = this.getFeatureInfo('structure', prop, propertyData.structure[prop]);
          if (info) {
            exterior.push({
              property: prop,
              value: propertyData.structure[prop],
              info
            });
          }
        }
      });
    }

    // Utility features (exterior)
    if (propertyData.utility) {
      const exteriorUtilityProperties = [
        'water_source_type',
        'sewer_type',
        'solar_panel_present',
        'solar_panel_type',
        'solar_inverter_visible',
        'public_utility_type'
      ];

      exteriorUtilityProperties.forEach(prop => {
        if (propertyData.utility[prop] && propertyData.utility[prop] !== 'other') {
          const info = this.getFeatureInfo('utility', prop, propertyData.utility[prop]);
          if (info) {
            exterior.push({
              property: prop,
              value: propertyData.utility[prop],
              info
            });
          }
        }
      });
    }

    // Lot features (exterior)
    if (propertyData.lot) {
      const lotProperties = [
        'view',
        'fencing_type',
        'driveway_material'
      ];

      lotProperties.forEach(prop => {
        if (propertyData.lot[prop] && propertyData.lot[prop] !== 'null') {
          const info = this.getFeatureInfo('lot', prop, propertyData.lot[prop]);
          if (info) {
            exterior.push({
              property: prop,
              value: propertyData.lot[prop],
              info
            });
          }
        }
      });
    }

    return { interior, exterior };
  }

  private formatDisplayText(value: string): string {
    if (typeof value !== 'string') {
      console.warn(`formatDisplayText called with non-string value:`, value, typeof value);
      return String(value);
    }
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get icon path for a feature
   */
  public getIconPath(iconName: string): string | null {
    // Use the iconName directly from the data mapping
    // The iconName in data-mapping.json should correspond to actual icon files
    if (!iconName || iconName === '') {
      return null; // No icon to display
    }
    
    // Check if the iconName already includes the file extension
    if (iconName.endsWith('.svg')) {
      return iconName;
    }
    
    // Add the type= prefix and .svg extension if not present
    const iconPath = `type=${iconName}.svg`;
    
    // Check if the icon actually exists in the assets directory
    const staticAssetsDir = path.join(__dirname, '..', '..', 'templates', 'assets', 'static');
    const fullIconPath = path.join(staticAssetsDir, iconPath);
    
    try {
      if (fs.existsSync(fullIconPath)) {
        return iconPath;
      } else {
        return null; // Icon doesn't exist, hide it
      }
    } catch (error) {
      return null; // Error checking file, hide it
    }
  }

  /**
   * Check if an icon exists in the assets
   */
  public iconExists(iconName: string): boolean {
    const iconPath = this.getIconPath(iconName);
    if (!iconPath) return false;
    
    // For now, we'll assume the icon exists if it has a valid path
    // In a production environment, you might want to actually check the file system
    return true;
  }

  /**
   * Get all unique properties for a given lexicon class from data-mapping.json
   */
  public getUniquePropertiesForLexiconClass(lexiconClass: string): string[] {
    const properties = new Set<string>();
    
    this.dataMapping.forEach(mapping => {
      if (mapping.lexiconClass === lexiconClass) {
        properties.add(mapping.lexiconProperty);
      }
    });
    
    return Array.from(properties);
  }
} 