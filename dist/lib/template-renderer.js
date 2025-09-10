import nunjucks from 'nunjucks';
import { DateTime } from 'luxon';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Minifier } from './minifier.js';
import { Logger } from './logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class TemplateRenderer {
    options;
    env;
    minifier;
    svgCache;
    constructor(options) {
        this.options = options;
        this.svgCache = new Map();
        const templatesPath = path.join(__dirname, '..', '..', 'templates');
        this.env = nunjucks.configure(templatesPath, {
            autoescape: true,
            throwOnUndefined: false,
        });
        const logger = new Logger({
            quiet: options.quiet,
            verbose: options.verbose,
            ci: options.ci,
            logFile: options.logFile,
        });
        this.minifier = new Minifier(options.minify || false, logger);
        this.setupFilters();
        this.clearSvgCache();
    }
    clearSvgCache() {
        this.svgCache.clear();
    }
    removeProblemMasks(svgContent) {
        const problematicColors = ['#D9D9D9', '#423E3E'];
        const maskIds = [];
        problematicColors.forEach(color => {
            const maskRegex = new RegExp(`<mask[^>]*id="([^"]*)"[^>]*>[\\s\\S]*?<rect[^>]*fill="${color.replace('#', '\\#')}"[^>]*\\/>[\\s\\S]*?<\\/mask>`, 'gi');
            let match;
            while ((match = maskRegex.exec(svgContent)) !== null) {
                maskIds.push(match[1]);
            }
            svgContent = svgContent.replace(maskRegex, '');
            const altMaskRegex = new RegExp(`<mask[^>]*>[\\s\\S]*?<rect[^>]*fill="${color.replace('#', '\\#')}"[\\s\\S]*?<\\/mask>`, 'gi');
            svgContent = svgContent.replace(altMaskRegex, '');
        });
        maskIds.forEach(maskId => {
            const groupRegex = new RegExp(`<g\\s+mask="url\\(#${maskId}\\)"[^>]*>([\\s\\S]*?)<\\/g>`, 'gi');
            svgContent = svgContent.replace(groupRegex, '$1');
        });
        return svgContent;
    }
    loadSvgContent(filename) {
        if (this.svgCache.has(filename)) {
            return this.svgCache.get(filename);
        }
        const staticPath = path.join(__dirname, '..', '..', 'templates', 'assets', 'static', filename);
        try {
            if (fs.existsSync(staticPath)) {
                let svgContent = fs.readFileSync(staticPath, 'utf8');
                svgContent = svgContent
                    .replace(/\swidth="[^"]*"/gi, '')
                    .replace(/\sheight="[^"]*"/gi, '')
                    .trim();
                svgContent = this.removeProblemMasks(svgContent);
                if (this.options.minify) {
                    svgContent = svgContent
                        .replace(/<!--.*?-->/gs, '')
                        .replace(/\s+/g, ' ')
                        .replace(/>\s+</g, '><')
                        .trim();
                }
                this.svgCache.set(filename, svgContent);
                return svgContent;
            }
        }
        catch (error) {
            console.warn(`Failed to load SVG file ${filename}:`, error);
        }
        return null;
    }
    setupFilters() {
        this.env.addFilter('readableDate', (dateObj) => {
            return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('dd LLL yyyy');
        });
        this.env.addFilter('toFixed1', function (value) {
            const num = typeof value === 'number' ? value : parseFloat(value);
            return isNaN(num) ? value : num.toFixed(1);
        });
        this.env.addFilter('htmlDateString', (dateObj) => {
            return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('yyyy-LL-dd');
        });
        this.env.addFilter('head', (array, n) => {
            if (!Array.isArray(array) || array.length === 0) {
                return [];
            }
            if (n < 0) {
                return array.slice(n);
            }
            return array.slice(0, n);
        });
        this.env.addFilter('min', (...numbers) => {
            return Math.min.apply(null, numbers);
        });
        this.env.addFilter('getAllTags', (collection) => {
            const tagSet = new Set();
            for (const item of collection) {
                (item.data.tags || []).forEach((tag) => tagSet.add(tag));
            }
            return Array.from(tagSet);
        });
        this.env.addFilter('filterTagList', (tags) => {
            return (tags || []).filter((tag) => ['all', 'nav', 'post', 'posts'].indexOf(tag) === -1);
        });
        this.env.addFilter('formatCurrency', (value) => {
            const num = typeof value === 'number' ? value : parseFloat(value);
            if (isNaN(num))
                return value;
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(num);
        });
        this.env.addFilter('formatNumber', (value) => {
            const num = typeof value === 'number' ? value : parseFloat(value);
            if (isNaN(num))
                return value;
            return new Intl.NumberFormat('en-US').format(num);
        });
        this.env.addFilter('formatDate', (dateStr) => {
            if (!dateStr)
                return '';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                });
            }
            catch {
                return dateStr;
            }
        });
        this.env.addFilter('formatYear', (dateStr) => {
            if (!dateStr)
                return '';
            try {
                const date = new Date(dateStr);
                return date.getFullYear();
            }
            catch {
                return dateStr;
            }
        });
        this.env.addFilter('json', (value) => {
            return JSON.stringify(value, null, 2);
        });
        this.env.addFilter('keys', (obj) => {
            return Object.keys(obj || {});
        });
        this.env.addFilter('values', (obj) => {
            return Object.values(obj || {});
        });
        this.env.addFilter('entries', (obj) => {
            return Object.entries(obj || {});
        });
        this.env.addFilter('sortBy', (array, key) => {
            if (!Array.isArray(array))
                return array;
            return array.slice().sort((a, b) => {
                const aVal = a[key];
                const bVal = b[key];
                if (aVal < bVal)
                    return -1;
                if (aVal > bVal)
                    return 1;
                return 0;
            });
        });
        this.env.addFilter('reverse', (array) => {
            if (!Array.isArray(array))
                return array;
            return array.slice().reverse();
        });
        this.env.addFilter('first', (array) => {
            return array && array.length > 0 ? array[0] : undefined;
        });
        this.env.addFilter('last', (array) => {
            return array && array.length > 0 ? array[array.length - 1] : undefined;
        });
        this.env.addFilter('pluck', (array, key) => {
            if (!Array.isArray(array))
                return [];
            return array.map((item) => item[key]);
        });
        this.env.addFilter('sum', (array, key) => {
            if (!Array.isArray(array))
                return 0;
            if (key) {
                return array.reduce((sum, item) => sum + (parseFloat(item[key]) || 0), 0);
            }
            return array.reduce((sum, item) => sum + (parseFloat(item) || 0), 0);
        });
        this.env.addFilter('average', (array, key) => {
            if (!Array.isArray(array) || array.length === 0)
                return 0;
            const sum = this.env.getFilter('sum')(array, key);
            return sum / array.length;
        });
        this.env.addFilter('groupBy', (array, key) => {
            if (!Array.isArray(array))
                return {};
            return array.reduce((groups, item) => {
                const group = item[key];
                if (!groups[group])
                    groups[group] = [];
                groups[group].push(item);
                return groups;
            }, {});
        });
        this.env.addFilter('where', (array, key, value) => {
            if (!Array.isArray(array))
                return [];
            return array.filter((item) => item[key] === value);
        });
        this.env.addFilter('whereNot', (array, key, value) => {
            if (!Array.isArray(array))
                return [];
            return array.filter((item) => item[key] !== value);
        });
        this.env.addFilter('compact', (array) => {
            if (!Array.isArray(array))
                return [];
            return array.filter(Boolean);
        });
        this.env.addFilter('unique', (array) => {
            if (!Array.isArray(array))
                return [];
            return [...new Set(array)];
        });
        this.env.addFilter('flatten', (array) => {
            if (!Array.isArray(array))
                return [];
            return array.flat();
        });
        this.env.addFilter('deepFlatten', (array) => {
            if (!Array.isArray(array))
                return [];
            return array.flat(Infinity);
        });
        this.env.addFilter('chunk', (array, size) => {
            if (!Array.isArray(array))
                return [];
            const chunks = [];
            for (let i = 0; i < array.length; i += size) {
                chunks.push(array.slice(i, i + size));
            }
            return chunks;
        });
        this.env.addFilter('take', (array, n) => {
            if (!Array.isArray(array))
                return [];
            return array.slice(0, n);
        });
        this.env.addFilter('drop', (array, n) => {
            if (!Array.isArray(array))
                return [];
            return array.slice(n);
        });
        this.env.addFilter('startsWith', (str, prefix) => {
            if (typeof str !== 'string')
                return false;
            return str.startsWith(prefix);
        });
        this.env.addFilter('endsWith', (str, suffix) => {
            if (typeof str !== 'string')
                return false;
            return str.endsWith(suffix);
        });
        this.env.addFilter('includes', (str, substring) => {
            if (typeof str !== 'string')
                return false;
            return str.includes(substring);
        });
        this.env.addFilter('padStart', (str, length, char = ' ') => {
            if (typeof str !== 'string')
                str = String(str);
            return str.padStart(length, char);
        });
        this.env.addFilter('padEnd', (str, length, char = ' ') => {
            if (typeof str !== 'string')
                str = String(str);
            return str.padEnd(length, char);
        });
        this.env.addFilter('truncate', (str, length, suffix = '...') => {
            if (typeof str !== 'string')
                return str;
            if (str.length <= length)
                return str;
            return str.slice(0, length - suffix.length) + suffix;
        });
        this.env.addFilter('slugify', (str) => {
            if (typeof str !== 'string')
                return str;
            return str
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        });
        this.env.addFilter('capitalize', (str) => {
            if (typeof str !== 'string')
                return str;
            return str.charAt(0).toUpperCase() + str.slice(1);
        });
        this.env.addFilter('titleCase', (str) => {
            if (typeof str !== 'string')
                return str;
            return str.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
            });
        });
        this.env.addFilter('camelCase', (str) => {
            if (typeof str !== 'string')
                return str;
            return str
                .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            })
                .replace(/\s+/g, '');
        });
        this.env.addFilter('kebabCase', (str) => {
            if (typeof str !== 'string')
                return str;
            return str
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/\s+/g, '-')
                .toLowerCase();
        });
        this.env.addFilter('snakeCase', (str) => {
            if (typeof str !== 'string')
                return str;
            return str
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/\s+/g, '_')
                .toLowerCase();
        });
        this.env.addFilter('isString', (value) => typeof value === 'string');
        this.env.addFilter('isNumber', (value) => typeof value === 'number');
        this.env.addFilter('isArray', (value) => Array.isArray(value));
        this.env.addFilter('isObject', (value) => typeof value === 'object' && value !== null && !Array.isArray(value));
        this.env.addFilter('isBoolean', (value) => typeof value === 'boolean');
        this.env.addFilter('isFunction', (value) => typeof value === 'function');
        this.env.addFilter('isNull', (value) => value === null);
        this.env.addFilter('isUndefined', (value) => value === undefined);
        this.env.addFilter('isDefined', (value) => value !== undefined);
        this.env.addFilter('isTruthy', (value) => !!value);
        this.env.addFilter('isFalsy', (value) => !value);
        this.env.addFilter('isEmpty', (value) => {
            if (value === null || value === undefined)
                return true;
            if (typeof value === 'string' || Array.isArray(value))
                return value.length === 0;
            if (typeof value === 'object')
                return Object.keys(value).length === 0;
            return false;
        });
        this.env.addFilter('default', (value, defaultValue) => {
            return value !== undefined && value !== null ? value : defaultValue;
        });
        this.env.addFilter('ternary', (condition, trueValue, falseValue) => {
            return condition ? trueValue : falseValue;
        });
        this.env.addFilter('assetUrl', (filename, propertyImages) => {
            if (filename.includes('favicon') || filename.includes('elephant_logo')) {
                return `./${filename}`;
            }
            if (this.options.inlineSvg && filename.endsWith('.svg') && !filename.includes('elephant_logo')) {
                const svgContent = this.loadSvgContent(filename);
                if (svgContent) {
                    return svgContent;
                }
            }
            if (this.options.dev) {
                return `./${filename}`;
            }
            if (propertyImages && propertyImages.includes(filename)) {
                return `./${filename}`;
            }
            const isDefaultDomain = !this.options.domain ||
                this.options.domain === 'https://elephant.xyz' ||
                this.options.domain.includes('elephant.xyz');
            if (isDefaultDomain) {
                return `./${filename}`;
            }
            const baseUrl = this.options.domain;
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            return `${cleanBase}/${filename}`;
        });
        this.env.addFilter('number', (value) => {
            const num = typeof value === 'number' ? value : parseFloat(value);
            if (isNaN(num))
                return value;
            return new Intl.NumberFormat('en-US').format(num);
        });
        this.env.addFilter('isSvg', (filename) => {
            return typeof filename === 'string' && filename.endsWith('.svg');
        });
    }
    async renderProperty(propertyId, propertyData) {
        const propertyDataPath = path.join(this.options.input, propertyId);
        const propertyImages = [];
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
        const propertyConfig = {};
        propertyConfig[propertyId] = {
            bedroom_count: propertyData.property?.beds || propertyData.building?.bedrooms || 0,
            bathroom_count: propertyData.property?.baths || propertyData.building?.bathrooms || 0,
            has_size_data: !!propertyData.building?.living_area || !!propertyData.property?.sqft,
            total_sqft: propertyData.building?.living_area || propertyData.property?.sqft || 0,
        };
        const templateData = {
            propertyId,
            property: propertyData,
            property_id: propertyId,
            homes: {
                [propertyId]: {
                    ...propertyData,
                    property: {
                        ...propertyData.property,
                        property_structure_built_year: propertyData.building?.year_built ||
                            propertyData.property?.property_structure_built_year,
                        builder_name: propertyData.building?.builder_name || propertyData.property?.builder_name,
                        property_legal_description_text: propertyData.property?.legalDescription ||
                            propertyData.property?.property_legal_description_text,
                        parcel_identifier: propertyData.property?.parcelId || propertyData.property?.parcel_identifier,
                        livable_floor_area: propertyData.building?.living_area || propertyData.property?.livable_floor_area,
                        property_type: propertyData.building?.property_type || propertyData.property?.property_type,
                        number_of_units_type: propertyData.property?.number_of_units_type,
                        subdivision: propertyData.property?.subdivision || '',
                        zoning: propertyData.property?.zoning || '',
                    },
                    layouts: propertyData.layouts || [],
                    mailing_address: propertyData.mailing_address || null,
                    flood_storm_information: propertyData.flood_storm_information || null,
                },
            },
            property_config: propertyConfig,
            propertyImages,
            config: {
                domain: this.options.domain || 'https://elephant.xyz/homes/public',
                inlineCss: this.options.inlineCss || false,
                inlineJs: this.options.inlineJs || false,
                inlineSvg: this.options.inlineSvg || false,
                dev: this.options.dev || false,
            },
            buildTime: new Date().toISOString(),
            flattenedData: propertyData.flattenedData,
        };
        console.log('propertyData', propertyData);
        if (this.options.inlineCss) {
            const cssFiles = ['root_style.css', 'property.css'];
            const cssContents = [];
            for (const cssFile of cssFiles) {
                const cssPath = path.join(__dirname, '..', '..', 'templates', 'assets', 'css', cssFile);
                if (await fs.pathExists(cssPath)) {
                    const content = await fs.readFile(cssPath, 'utf8');
                    cssContents.push(content);
                }
            }
            let combinedCss = cssContents.join('\n');
            if (this.options.minify) {
                combinedCss = await this.minifier.minifyCSS(combinedCss);
            }
            templateData.config.inlineCssContent = combinedCss;
        }
        if (this.options.inlineJs) {
            const jsFiles = ['property.js'];
            const jsContents = [];
            for (const jsFile of jsFiles) {
                const jsPath = path.join(__dirname, '..', '..', 'templates', 'assets', 'js', jsFile);
                if (await fs.pathExists(jsPath)) {
                    const content = await fs.readFile(jsPath, 'utf8');
                    jsContents.push(content);
                }
            }
            const libFiles = ['chart.min.js', 'chartjs-adapter-date-fns.bundle.min.js'];
            for (const libFile of libFiles) {
                const libPath = path.join(__dirname, '..', '..', 'templates', 'assets', 'js', libFile);
                if (await fs.pathExists(libPath)) {
                    const content = await fs.readFile(libPath, 'utf8');
                    jsContents.push(content);
                }
            }
            let combinedJs = jsContents.join('\n');
            if (this.options.minify) {
                combinedJs = await this.minifier.minifyJS(combinedJs);
            }
            templateData.config.inlineJsContent = combinedJs;
        }
        let html = this.env.render('property.njk', templateData);
        if (this.options.minify) {
            html = await this.minifier.minifyHTML(html);
        }
        return html;
    }
}
//# sourceMappingURL=template-renderer.js.map