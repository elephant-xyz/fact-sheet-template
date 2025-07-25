import nunjucks from 'nunjucks';
import { DateTime } from "luxon";
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BuilderOptions, PropertyData } from '../types/property.js';
import { FeatureMapper } from './feature-mapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TemplateRenderer {
  private options: BuilderOptions;
  private env: nunjucks.Environment;
  private featureMapper: FeatureMapper;

  constructor(options: BuilderOptions) {
    this.options = options;
    this.featureMapper = new FeatureMapper();
    
    // Set up Nunjucks environment
    const templatesPath = path.join(__dirname, '..', '..', 'templates');
    this.env = nunjucks.configure(templatesPath, {
      autoescape: true,
      throwOnUndefined: false
    });
    
    this.setupFilters();
  }

  private setupFilters(): void {
    // Port filters from .eleventy.js
    this.env.addFilter("readableDate", (dateObj: Date) => {
      return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
        "dd LLL yyyy",
      );
    });

    this.env.addFilter("toFixed1", function (value: any): string | any {
      const num = typeof value === "number" ? value : parseFloat(value);
      return isNaN(num) ? value : num.toFixed(1);
    });

    this.env.addFilter("htmlDateString", (dateObj: Date) => {
      return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
    });

    this.env.addFilter("head", (array: any[], n: number) => {
      if (!Array.isArray(array) || array.length === 0) {
        return [];
      }
      if (n < 0) {
        return array.slice(n);
      }
      return array.slice(0, n);
    });

    this.env.addFilter("min", (...numbers: number[]) => {
      return Math.min.apply(null, numbers);
    });

    this.env.addFilter("getAllTags", (collection: any[]) => {
      let tagSet = new Set<string>();
      for (let item of collection) {
        (item.data.tags || []).forEach((tag: string) => tagSet.add(tag));
      }
      return Array.from(tagSet);
    });

    this.env.addFilter("filterTagList", (tags: string[]) => {
      return (tags || []).filter(
        (tag) => ["all", "nav", "post", "posts"].indexOf(tag) === -1,
      );
    });

    this.env.addFilter("formatCurrency", (value: any) => {
      const num = typeof value === "number" ? value : parseFloat(value);
      if (isNaN(num)) return value;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    });

    this.env.addFilter("formatNumber", (value: any) => {
      const num = typeof value === "number" ? value : parseFloat(value);
      if (isNaN(num)) return value;
      return new Intl.NumberFormat("en-US").format(num);
    });

    this.env.addFilter("formatDate", (dateStr: string) => {
      if (!dateStr) return "";
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch (e) {
        return dateStr;
      }
    });

    this.env.addFilter("formatYear", (dateStr: string) => {
      if (!dateStr) return "";
      try {
        const date = new Date(dateStr);
        return date.getFullYear();
      } catch (e) {
        return dateStr;
      }
    });

    this.env.addFilter("json", (value: any) => {
      return JSON.stringify(value, null, 2);
    });

    this.env.addFilter("keys", (obj: Record<string, any>) => {
      return Object.keys(obj || {});
    });

    this.env.addFilter("values", (obj: Record<string, any>) => {
      return Object.values(obj || {});
    });

    this.env.addFilter("entries", (obj: Record<string, any>) => {
      return Object.entries(obj || {});
    });

    this.env.addFilter("sortBy", (array: any[], key: string) => {
      if (!Array.isArray(array)) return array;
      return array.slice().sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    });

    this.env.addFilter("reverse", (array: any[]) => {
      if (!Array.isArray(array)) return array;
      return array.slice().reverse();
    });

    this.env.addFilter("first", (array: any[]) => {
      return array && array.length > 0 ? array[0] : undefined;
    });

    this.env.addFilter("last", (array: any[]) => {
      return array && array.length > 0 ? array[array.length - 1] : undefined;
    });

    this.env.addFilter("pluck", (array: any[], key: string) => {
      if (!Array.isArray(array)) return [];
      return array.map((item) => item[key]);
    });

    this.env.addFilter("sum", (array: any[], key?: string) => {
      if (!Array.isArray(array)) return 0;
      if (key) {
        return array.reduce((sum, item) => sum + (parseFloat(item[key]) || 0), 0);
      }
      return array.reduce((sum, item) => sum + (parseFloat(item) || 0), 0);
    });

    this.env.addFilter("average", (array: any[], key?: string) => {
      if (!Array.isArray(array) || array.length === 0) return 0;
      const sum = this.env.getFilter("sum")(array, key) as number;
      return sum / array.length;
    });

    this.env.addFilter("groupBy", (array: any[], key: string) => {
      if (!Array.isArray(array)) return {};
      return array.reduce((groups, item) => {
        const group = item[key];
        if (!groups[group]) groups[group] = [];
        groups[group].push(item);
        return groups;
      }, {} as Record<string, any[]>);
    });

    this.env.addFilter("where", (array: any[], key: string, value: any) => {
      if (!Array.isArray(array)) return [];
      return array.filter((item) => item[key] === value);
    });

    this.env.addFilter("whereNot", (array: any[], key: string, value: any) => {
      if (!Array.isArray(array)) return [];
      return array.filter((item) => item[key] !== value);
    });

    this.env.addFilter("compact", (array: any[]) => {
      if (!Array.isArray(array)) return [];
      return array.filter(Boolean);
    });

    this.env.addFilter("unique", (array: any[]) => {
      if (!Array.isArray(array)) return [];
      return [...new Set(array)];
    });

    this.env.addFilter("flatten", (array: any[]) => {
      if (!Array.isArray(array)) return [];
      return array.flat();
    });

    this.env.addFilter("deepFlatten", (array: any[]) => {
      if (!Array.isArray(array)) return [];
      return array.flat(Infinity);
    });

    this.env.addFilter("chunk", (array: any[], size: number) => {
      if (!Array.isArray(array)) return [];
      const chunks = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    });

    this.env.addFilter("take", (array: any[], n: number) => {
      if (!Array.isArray(array)) return [];
      return array.slice(0, n);
    });

    this.env.addFilter("drop", (array: any[], n: number) => {
      if (!Array.isArray(array)) return [];
      return array.slice(n);
    });

    this.env.addFilter("startsWith", (str: string, prefix: string) => {
      if (typeof str !== "string") return false;
      return str.startsWith(prefix);
    });

    this.env.addFilter("endsWith", (str: string, suffix: string) => {
      if (typeof str !== "string") return false;
      return str.endsWith(suffix);
    });

    this.env.addFilter("includes", (str: string, substring: string) => {
      if (typeof str !== "string") return false;
      return str.includes(substring);
    });

    this.env.addFilter("padStart", (str: string, length: number, char = " ") => {
      if (typeof str !== "string") str = String(str);
      return str.padStart(length, char);
    });

    this.env.addFilter("padEnd", (str: string, length: number, char = " ") => {
      if (typeof str !== "string") str = String(str);
      return str.padEnd(length, char);
    });

    this.env.addFilter("truncate", (str: string, length: number, suffix = "...") => {
      if (typeof str !== "string") return str;
      if (str.length <= length) return str;
      return str.slice(0, length - suffix.length) + suffix;
    });

    this.env.addFilter("slugify", (str: string) => {
      if (typeof str !== "string") return str;
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    });

    this.env.addFilter("capitalize", (str: string) => {
      if (typeof str !== "string") return str;
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    this.env.addFilter("titleCase", (str: string) => {
      if (typeof str !== "string") return str;
      return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
      });
    });

    this.env.addFilter("camelCase", (str: string) => {
      if (typeof str !== "string") return str;
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, "");
    });

    this.env.addFilter("kebabCase", (str: string) => {
      if (typeof str !== "string") return str;
      return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/\s+/g, "-")
        .toLowerCase();
    });

    this.env.addFilter("snakeCase", (str: string) => {
      if (typeof str !== "string") return str;
      return str
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/\s+/g, "_")
        .toLowerCase();
    });

    this.env.addFilter("isString", (value: any) => typeof value === "string");
    this.env.addFilter("isNumber", (value: any) => typeof value === "number");
    this.env.addFilter("isArray", (value: any) => Array.isArray(value));
    this.env.addFilter("isObject", (value: any) => typeof value === "object" && value !== null && !Array.isArray(value));
    this.env.addFilter("isBoolean", (value: any) => typeof value === "boolean");
    this.env.addFilter("isFunction", (value: any) => typeof value === "function");
    this.env.addFilter("isNull", (value: any) => value === null);
    this.env.addFilter("isUndefined", (value: any) => value === undefined);
    this.env.addFilter("isDefined", (value: any) => value !== undefined);
    this.env.addFilter("isTruthy", (value: any) => !!value);
    this.env.addFilter("isFalsy", (value: any) => !value);
    this.env.addFilter("isEmpty", (value: any) => {
      if (value === null || value === undefined) return true;
      if (typeof value === "string" || Array.isArray(value)) return value.length === 0;
      if (typeof value === "object") return Object.keys(value).length === 0;
      return false;
    });

    this.env.addFilter("default", (value: any, defaultValue: any) => {
      return value !== undefined && value !== null ? value : defaultValue;
    });

    this.env.addFilter("ternary", (condition: any, trueValue: any, falseValue: any) => {
      return condition ? trueValue : falseValue;
    });

    // Add assetUrl filter for asset paths
    this.env.addFilter("assetUrl", (filename: string, propertyImages?: string[]) => {
      // In dev mode, use relative paths
      if (this.options.dev) {
        return `./${filename}`;
      }
      
      // Check if this image exists in property data
      if (propertyImages && propertyImages.includes(filename)) {
        // Use local path for property-specific images
        return `./${filename}`;
      }
      
      // Check if using default elephant.xyz domain
      const isDefaultDomain = !this.options.domain || 
                             this.options.domain === 'https://elephant.xyz' ||
                             this.options.domain.includes('elephant.xyz');
      
      if (isDefaultDomain) {
        // For default domain, all assets use CDN
        return `https://elephant.xyz/homes/public/${filename}`;
      }
      
      // For custom domains, use the provided domain
      const baseUrl = this.options.domain!; // We know it's defined here
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      // Return the full URL
      return `${cleanBase}/${filename}`;
    });

    // Add number filter for numeric formatting
    this.env.addFilter("number", (value: any) => {
      const num = typeof value === "number" ? value : parseFloat(value);
      if (isNaN(num)) return value;
      return new Intl.NumberFormat("en-US").format(num);
    });

    // Add icon path filter
    this.env.addFilter("getIconPath", (iconName: string) => {
      return this.featureMapper.getIconPath(iconName);
    });
  }

  async renderProperty(propertyId: string, propertyData: PropertyData): Promise<string> {
    // Check for property-specific images
    const propertyDataPath = path.join(this.options.input, propertyId);
    const propertyImages: string[] = [];
    
    if (await fs.pathExists(propertyDataPath)) {
      const files = await fs.readdir(propertyDataPath);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (imageExtensions.includes(ext)) {
          propertyImages.push(file);
        }
      }
    }
    
    // Calculate bedroom/bathroom counts for property_config
    const propertyConfig: any = {};
    propertyConfig[propertyId] = {
      bedroom_count: propertyData.property?.beds || propertyData.building?.bedrooms || 0,
      bathroom_count: propertyData.property?.baths || propertyData.building?.bathrooms || 0,
      has_size_data: !!propertyData.building?.living_area || !!propertyData.property?.sqft,
      total_sqft: propertyData.building?.living_area || propertyData.property?.sqft || 0
    };
    
    // Prepare template data
    const templateData: any = {
      propertyId,
      property: propertyData,
      property_id: propertyId, // For template compatibility
      homes: { 
        [propertyId]: {
          ...propertyData,
          property: {
            ...propertyData.property, // Preserve existing property data
            property_structure_built_year: propertyData.building?.year_built || propertyData.property?.property_structure_built_year,
            builder_name: propertyData.building?.builder_name || propertyData.property?.builder_name,
            property_legal_description_text: propertyData.property?.legalDescription || propertyData.property?.property_legal_description_text,
            parcel_identifier: propertyData.property?.parcelId || propertyData.property?.parcel_identifier,
            livable_floor_area: propertyData.building?.living_area || propertyData.property?.livable_floor_area,
            property_type: propertyData.building?.property_type || propertyData.property?.property_type,
            number_of_units_type: propertyData.property?.number_of_units_type
          }
        }
      }, // For template compatibility
      property_config: propertyConfig, // For floorplan section
      propertyImages, // List of available property-specific images
      config: {
        domain: this.options.domain || 'https://elephant.xyz/homes/public',
        inlineCss: this.options.inlineCss || false,
        inlineJs: this.options.inlineJs || false,
        dev: this.options.dev || false
      },
      buildTime: new Date().toISOString()
    };
    
    // Handle inline CSS if requested
    if (this.options.inlineCss) {
      const cssFiles = ['root_style.css', 'property.css'];
      const cssContents: string[] = [];
      
      for (const cssFile of cssFiles) {
        const cssPath = path.join(__dirname, '..', '..', 'templates', 'assets', 'css', cssFile);
        if (await fs.pathExists(cssPath)) {
          const content = await fs.readFile(cssPath, 'utf8');
          cssContents.push(content);
        }
      }
      
      templateData.config.inlineCssContent = cssContents.join('\n');
    }

    // Handle inline JS if requested
    if (this.options.inlineJs) {
      const jsFiles = ['property.js'];
      const jsContents: string[] = [];
      
      for (const jsFile of jsFiles) {
        const jsPath = path.join(__dirname, '..', '..', 'templates', 'assets', 'js', jsFile);
        if (await fs.pathExists(jsPath)) {
          const content = await fs.readFile(jsPath, 'utf8');
          jsContents.push(content);
        }
      }
      
      // Also include external libraries if needed
      const libFiles = ['chart.min.js', 'chartjs-adapter-date-fns.bundle.min.js'];
      for (const libFile of libFiles) {
        const libPath = path.join(__dirname, '..', '..', 'templates', 'assets', 'js', libFile);
        if (await fs.pathExists(libPath)) {
          const content = await fs.readFile(libPath, 'utf8');
          jsContents.push(content);
        }
      }
      
      templateData.config.inlineJsContent = jsContents.join('\n');
    }

    // Render the template
    return this.env.render('property.njk', templateData);
  }
}