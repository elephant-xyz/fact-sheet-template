import fs from 'fs-extra';
import path from 'path';
import { PropertyData } from '../types/property.js';

export interface DataTypeMapping {
  label: string;
  sections: string[];
  data_paths: string[];
}

export interface SectionDefinition {
  id: string;
  class: string;
  title: string;
  description: string;
}

export interface VisibilityRules {
  default_behavior: 'show' | 'hide';
  show_when_data_present: boolean;
  hide_empty_sections: boolean;
  show_navigation_for_visible_sections_only: boolean;
}

export interface SectionVisibilityConfig {
  data_type_mappings: Record<string, DataTypeMapping>;
  section_definitions: Record<string, SectionDefinition>;
  visibility_rules: VisibilityRules;
}

export class SectionVisibilityManager {
  private config!: SectionVisibilityConfig;
  private logger: any;

  constructor(configPath: string, logger: any) {
    this.logger = logger;
    this.loadConfig(configPath);
  }

  private loadConfig(configPath: string): void {
    try {
      const configFile = path.resolve(configPath);
      if (!fs.existsSync(configFile)) {
        throw new Error(`Configuration file not found: ${configFile}`);
      }
      
      const configContent = fs.readFileSync(configFile, 'utf8');
      this.config = JSON.parse(configContent);
      this.logger.info('✅ Section visibility configuration loaded');
    } catch (error) {
      this.logger.error(`❌ Failed to load section visibility config: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if a data type is present in the property data
   */
  private hasDataType(dataType: string, propertyData: PropertyData): boolean {
    const mapping = this.config.data_type_mappings[dataType];
    if (!mapping) {
      this.logger.warn(`⚠️  Unknown data type: ${dataType}`);
      return false;
    }

    // Check if any of the data paths exist in the property data
    for (const dataPath of mapping.data_paths) {
      if (this.hasDataPath(dataPath, propertyData)) {
        this.logger.debug(`✅ Found data type '${dataType}' via path '${dataPath}'`);
        return true;
      }
    }

    this.logger.debug(`❌ Data type '${dataType}' not found in property data`);
    return false;
  }

  /**
   * Check if a specific data path exists in the property data
   */
  private hasDataPath(dataPath: string, propertyData: PropertyData): boolean {
    const pathParts = dataPath.split('.');
    let current: any = propertyData;

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    // Check if the data is not null, undefined, or empty
    if (Array.isArray(current)) {
      return current.length > 0;
    } else if (typeof current === 'string') {
      return current.trim().length > 0;
    } else if (typeof current === 'object') {
      return current !== null && Object.keys(current).length > 0;
    }

    return current !== null && current !== undefined;
  }

  /**
   * Get all visible sections based on data presence
   */
  public getVisibleSections(propertyData: PropertyData): string[] {
    const visibleSections = new Set<string>();

    // Check each data type mapping
    for (const [dataType, mapping] of Object.entries(this.config.data_type_mappings)) {
      if (this.hasDataType(dataType, propertyData)) {
        this.logger.info(`📊 Data type '${dataType}' found, showing sections: ${mapping.sections.join(', ')}`);
        
        // Add all sections for this data type
        for (const section of mapping.sections) {
          visibleSections.add(section);
        }
      }
    }

    // Convert to array and sort for consistency
    const result = Array.from(visibleSections).sort();
    this.logger.info(`🎯 Visible sections: ${result.join(', ')}`);
    
    return result;
  }

  /**
   * Check if a specific section should be visible
   */
  public isSectionVisible(sectionId: string, propertyData: PropertyData): boolean {
    const visibleSections = this.getVisibleSections(propertyData);
    return visibleSections.includes(sectionId);
  }

  /**
   * Get section definition by ID
   */
  public getSectionDefinition(sectionId: string): SectionDefinition | null {
    return this.config.section_definitions[sectionId] || null;
  }

  /**
   * Get all section definitions
   */
  public getAllSectionDefinitions(): Record<string, SectionDefinition> {
    return this.config.section_definitions;
  }

  /**
   * Get visibility rules
   */
  public getVisibilityRules(): VisibilityRules {
    return this.config.visibility_rules;
  }

  /**
   * Generate CSS classes for section visibility
   */
  public generateVisibilityClasses(propertyData: PropertyData): Record<string, string> {
    const visibleSections = this.getVisibleSections(propertyData);
    const classes: Record<string, string> = {};

    for (const sectionId of Object.keys(this.config.section_definitions)) {
      const isVisible = visibleSections.includes(sectionId);
      classes[sectionId] = isVisible ? 'section-visible' : 'section-hidden';
    }

    return classes;
  }

  /**
   * Generate navigation data for visible sections only
   */
  public generateNavigationData(propertyData: PropertyData): Array<{id: string, title: string, href: string}> {
    const visibleSections = this.getVisibleSections(propertyData);
    const navigation: Array<{id: string, title: string, href: string}> = [];

    for (const sectionId of visibleSections) {
      const definition = this.getSectionDefinition(sectionId);
      if (definition) {
        navigation.push({
          id: sectionId,
          title: definition.title,
          href: `#${sectionId}`
        });
      }
    }

    return navigation;
  }

  /**
   * Validate the configuration
   */
  public validateConfig(): boolean {
    try {
      // Check if all referenced sections exist in definitions
      for (const [dataType, mapping] of Object.entries(this.config.data_type_mappings)) {
        for (const section of mapping.sections) {
          if (!this.config.section_definitions[section]) {
            this.logger.error(`❌ Section '${section}' referenced in data type '${dataType}' not found in definitions`);
            return false;
          }
        }
      }

      this.logger.info('✅ Section visibility configuration is valid');
      return true;
    } catch (error) {
      this.logger.error(`❌ Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
} 