import nunjucks from 'nunjucks';
import { DateTime } from "luxon";
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class TemplateRenderer {
    options;
    env;
    constructor(options) {
        this.options = options;
        const templatesPath = path.join(__dirname, '..', 'templates');
        this.env = nunjucks.configure(templatesPath, {
            autoescape: true,
            throwOnUndefined: false
        });
        this.setupFilters();
    }
    setupFilters() {
        this.env.addFilter("readableDate", (dateObj) => {
            return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("dd LLL yyyy");
        });
        this.env.addFilter("toFixed1", function (value) {
            const num = typeof value === "number" ? value : parseFloat(value);
            return isNaN(num) ? value : num.toFixed(1);
        });
        this.env.addFilter("htmlDateString", (dateObj) => {
            return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
        });
        this.env.addFilter("head", (array, n) => {
            if (!Array.isArray(array) || array.length === 0) {
                return [];
            }
            if (n < 0) {
                return array.slice(n);
            }
            return array.slice(0, n);
        });
        this.env.addFilter("min", (...numbers) => {
            return Math.min.apply(null, numbers);
        });
        this.env.addFilter("getAllTags", (collection) => {
            let tagSet = new Set();
            for (let item of collection) {
                (item.data.tags || []).forEach((tag) => tagSet.add(tag));
            }
            return Array.from(tagSet);
        });
        this.env.addFilter("filterTagList", (tags) => {
            return (tags || []).filter((tag) => ["all", "nav", "post", "posts"].indexOf(tag) === -1);
        });
        this.env.addFilter("formatCurrency", (value) => {
            const num = typeof value === "number" ? value : parseFloat(value);
            if (isNaN(num))
                return value;
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(num);
        });
        this.env.addFilter("formatNumber", (value) => {
            const num = typeof value === "number" ? value : parseFloat(value);
            if (isNaN(num))
                return value;
            return new Intl.NumberFormat("en-US").format(num);
        });
        this.env.addFilter("formatDate", (dateStr) => {
            if (!dateStr)
                return "";
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                });
            }
            catch (e) {
                return dateStr;
            }
        });
        this.env.addFilter("formatYear", (dateStr) => {
            if (!dateStr)
                return "";
            try {
                const date = new Date(dateStr);
                return date.getFullYear();
            }
            catch (e) {
                return dateStr;
            }
        });
        this.env.addFilter("json", (value) => {
            return JSON.stringify(value, null, 2);
        });
        this.env.addFilter("keys", (obj) => {
            return Object.keys(obj || {});
        });
        this.env.addFilter("values", (obj) => {
            return Object.values(obj || {});
        });
        this.env.addFilter("entries", (obj) => {
            return Object.entries(obj || {});
        });
        this.env.addFilter("sortBy", (array, key) => {
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
        this.env.addFilter("reverse", (array) => {
            if (!Array.isArray(array))
                return array;
            return array.slice().reverse();
        });
        this.env.addFilter("first", (array) => {
            return array && array.length > 0 ? array[0] : undefined;
        });
        this.env.addFilter("last", (array) => {
            return array && array.length > 0 ? array[array.length - 1] : undefined;
        });
        this.env.addFilter("pluck", (array, key) => {
            if (!Array.isArray(array))
                return [];
            return array.map((item) => item[key]);
        });
        this.env.addFilter("sum", (array, key) => {
            if (!Array.isArray(array))
                return 0;
            if (key) {
                return array.reduce((sum, item) => sum + (parseFloat(item[key]) || 0), 0);
            }
            return array.reduce((sum, item) => sum + (parseFloat(item) || 0), 0);
        });
        this.env.addFilter("average", (array, key) => {
            if (!Array.isArray(array) || array.length === 0)
                return 0;
            const sum = this.env.getFilter("sum")(array, key);
            return sum / array.length;
        });
        this.env.addFilter("groupBy", (array, key) => {
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
        this.env.addFilter("where", (array, key, value) => {
            if (!Array.isArray(array))
                return [];
            return array.filter((item) => item[key] === value);
        });
        this.env.addFilter("whereNot", (array, key, value) => {
            if (!Array.isArray(array))
                return [];
            return array.filter((item) => item[key] !== value);
        });
        this.env.addFilter("compact", (array) => {
            if (!Array.isArray(array))
                return [];
            return array.filter(Boolean);
        });
        this.env.addFilter("unique", (array) => {
            if (!Array.isArray(array))
                return [];
            return [...new Set(array)];
        });
        this.env.addFilter("flatten", (array) => {
            if (!Array.isArray(array))
                return [];
            return array.flat();
        });
        this.env.addFilter("deepFlatten", (array) => {
            if (!Array.isArray(array))
                return [];
            return array.flat(Infinity);
        });
        this.env.addFilter("chunk", (array, size) => {
            if (!Array.isArray(array))
                return [];
            const chunks = [];
            for (let i = 0; i < array.length; i += size) {
                chunks.push(array.slice(i, i + size));
            }
            return chunks;
        });
        this.env.addFilter("take", (array, n) => {
            if (!Array.isArray(array))
                return [];
            return array.slice(0, n);
        });
        this.env.addFilter("drop", (array, n) => {
            if (!Array.isArray(array))
                return [];
            return array.slice(n);
        });
        this.env.addFilter("startsWith", (str, prefix) => {
            if (typeof str !== "string")
                return false;
            return str.startsWith(prefix);
        });
        this.env.addFilter("endsWith", (str, suffix) => {
            if (typeof str !== "string")
                return false;
            return str.endsWith(suffix);
        });
        this.env.addFilter("includes", (str, substring) => {
            if (typeof str !== "string")
                return false;
            return str.includes(substring);
        });
        this.env.addFilter("padStart", (str, length, char = " ") => {
            if (typeof str !== "string")
                str = String(str);
            return str.padStart(length, char);
        });
        this.env.addFilter("padEnd", (str, length, char = " ") => {
            if (typeof str !== "string")
                str = String(str);
            return str.padEnd(length, char);
        });
        this.env.addFilter("truncate", (str, length, suffix = "...") => {
            if (typeof str !== "string")
                return str;
            if (str.length <= length)
                return str;
            return str.slice(0, length - suffix.length) + suffix;
        });
        this.env.addFilter("slugify", (str) => {
            if (typeof str !== "string")
                return str;
            return str
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
        });
        this.env.addFilter("capitalize", (str) => {
            if (typeof str !== "string")
                return str;
            return str.charAt(0).toUpperCase() + str.slice(1);
        });
        this.env.addFilter("titleCase", (str) => {
            if (typeof str !== "string")
                return str;
            return str.replace(/\w\S*/g, (txt) => {
                return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
            });
        });
        this.env.addFilter("camelCase", (str) => {
            if (typeof str !== "string")
                return str;
            return str
                .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            })
                .replace(/\s+/g, "");
        });
        this.env.addFilter("kebabCase", (str) => {
            if (typeof str !== "string")
                return str;
            return str
                .replace(/([a-z])([A-Z])/g, "$1-$2")
                .replace(/\s+/g, "-")
                .toLowerCase();
        });
        this.env.addFilter("snakeCase", (str) => {
            if (typeof str !== "string")
                return str;
            return str
                .replace(/([a-z])([A-Z])/g, "$1_$2")
                .replace(/\s+/g, "_")
                .toLowerCase();
        });
        this.env.addFilter("isString", (value) => typeof value === "string");
        this.env.addFilter("isNumber", (value) => typeof value === "number");
        this.env.addFilter("isArray", (value) => Array.isArray(value));
        this.env.addFilter("isObject", (value) => typeof value === "object" && value !== null && !Array.isArray(value));
        this.env.addFilter("isBoolean", (value) => typeof value === "boolean");
        this.env.addFilter("isFunction", (value) => typeof value === "function");
        this.env.addFilter("isNull", (value) => value === null);
        this.env.addFilter("isUndefined", (value) => value === undefined);
        this.env.addFilter("isDefined", (value) => value !== undefined);
        this.env.addFilter("isTruthy", (value) => !!value);
        this.env.addFilter("isFalsy", (value) => !value);
        this.env.addFilter("isEmpty", (value) => {
            if (value === null || value === undefined)
                return true;
            if (typeof value === "string" || Array.isArray(value))
                return value.length === 0;
            if (typeof value === "object")
                return Object.keys(value).length === 0;
            return false;
        });
        this.env.addFilter("default", (value, defaultValue) => {
            return value !== undefined && value !== null ? value : defaultValue;
        });
        this.env.addFilter("ternary", (condition, trueValue, falseValue) => {
            return condition ? trueValue : falseValue;
        });
        this.env.addFilter("assetUrl", (filename) => {
            if (this.options.dev) {
                return `./${filename}`;
            }
            const baseUrl = this.options.domain || 'https://elephant.xyz/homes/public';
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            return `${cleanBase}/${filename}`;
        });
        this.env.addFilter("number", (value) => {
            const num = typeof value === "number" ? value : parseFloat(value);
            if (isNaN(num))
                return value;
            return new Intl.NumberFormat("en-US").format(num);
        });
    }
    async renderProperty(propertyId, propertyData) {
        const templateData = {
            propertyId,
            property: propertyData,
            property_id: propertyId,
            homes: { [propertyId]: propertyData },
            config: {
                domain: this.options.domain || 'https://elephant.xyz/homes/public',
                inlineCss: this.options.inlineCss || false,
                inlineJs: this.options.inlineJs || false,
                dev: this.options.dev || false
            },
            buildTime: new Date().toISOString()
        };
        if (this.options.inlineCss) {
            const cssFiles = ['root_style.css', 'property.css'];
            const cssContents = [];
            for (const cssFile of cssFiles) {
                const cssPath = path.join(__dirname, '..', 'templates', 'assets', 'css', cssFile);
                if (await fs.pathExists(cssPath)) {
                    const content = await fs.readFile(cssPath, 'utf8');
                    cssContents.push(content);
                }
            }
            templateData.config.inlineCssContent = cssContents.join('\n');
        }
        if (this.options.inlineJs) {
            const jsFiles = ['property.js'];
            const jsContents = [];
            for (const jsFile of jsFiles) {
                const jsPath = path.join(__dirname, '..', 'templates', 'assets', 'js', jsFile);
                if (await fs.pathExists(jsPath)) {
                    const content = await fs.readFile(jsPath, 'utf8');
                    jsContents.push(content);
                }
            }
            const libFiles = ['chart.min.js', 'chartjs-adapter-date-fns.bundle.min.js'];
            for (const libFile of libFiles) {
                const libPath = path.join(__dirname, '..', 'templates', 'assets', 'js', libFile);
                if (await fs.pathExists(libPath)) {
                    const content = await fs.readFile(libPath, 'utf8');
                    jsContents.push(content);
                }
            }
            templateData.config.inlineJsContent = jsContents.join('\n');
        }
        return this.env.render('property.njk', templateData);
    }
}
//# sourceMappingURL=template-renderer.js.map