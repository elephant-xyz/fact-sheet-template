import fs from 'fs';
import path from 'path';
import { Logger } from './logger.js';

interface LabelToDivMapping {
  [label: string]: string[];
}

interface VisibilityConfig {
  label_to_div_mapping: LabelToDivMapping;
}

export class SectionVisibilityFilter {
  private config: VisibilityConfig;
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
    this.config = this.loadConfig();
  }

  private loadConfig(): VisibilityConfig {
    try {
      const configPath = path.join(process.cwd(), 'config', 'section-visibility.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData) as VisibilityConfig;
    } catch (error) {
      this.logger.error('Failed to load section visibility config:', { error: error instanceof Error ? error.message : String(error) });
      return { label_to_div_mapping: {} };
    }
  }

  /**
   * Check if a label is present in the data
   */
  public hasLabel(data: any, label: string): boolean {
    if (!data) return false;
    
    // Check if labels array exists in PropertyData structure
    if (data.labels && Array.isArray(data.labels)) {
      return data.labels.includes(label);
    }
    
    // Recursively search for the label in the data
    const searchForLabel = (obj: any): boolean => {
      if (typeof obj !== 'object' || obj === null) return false;
      
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'label' && value === label) {
          return true;
        }
        if (typeof value === 'object' && searchForLabel(value)) {
          return true;
        }
      }
      return false;
    };
    
    return searchForLabel(data);
  }

  /**
   * Get all divs that should be shown for a given label
   */
  public getDivsForLabel(label: string): string[] {
    return this.config.label_to_div_mapping[label] || [];
  }

  /**
   * Get all divs that should be shown based on labels found in data
   */
  public getVisibleDivs(data: any): string[] {
    const visibleDivs: string[] = [];
    
    for (const [label, divs] of Object.entries(this.config.label_to_div_mapping)) {
      if (this.hasLabel(data, label)) {
        visibleDivs.push(...divs);
      }
    }
    
    return [...new Set(visibleDivs)]; // Remove duplicates
  }

  /**
   * Check if a specific div should be visible based on data
   */
  public isDivVisible(data: any, divId: string): boolean {
    const visibleDivs = this.getVisibleDivs(data);
    return visibleDivs.includes(divId);
  }

  /**
   * Get CSS classes for visibility
   */
  public getVisibilityClasses(data: any, divId: string): string {
    return this.isDivVisible(data, divId) ? 'visible' : 'hidden';
  }
} 