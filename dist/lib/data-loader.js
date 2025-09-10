import path from 'path';
import fs from 'fs-extra';
import { Logger } from './logger.js';
import { IPLDDataLoader } from './ipld-data-loader.js';
import { CID } from 'multiformats/cid';
import { existsSync } from 'fs';
export class DataLoader {
    logger;
    ipldLoader;
    dataDir;
    fsReadCache;
    constructor(options) {
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
    async loadPropertyData(inputDir) {
        const homes = {};
        const directories = await fs.readdir(inputDir);
        this.logger.info('Using IPLD data loader');
        for (const dir of directories) {
            const dirPath = path.join(inputDir, dir);
            const stats = await fs.stat(dirPath);
            if (stats.isDirectory()) {
                try {
                    const propertyData = await this.ipldLoader.loadPropertyData(dir);
                    homes[dir] = this.transformIPLDData(propertyData);
                    homes[dir].flattenedData = await this.flattenData(dir);
                }
                catch (error) {
                    this.logger.warn(`Failed to load IPLD data for ${dir}: ${error.stack}`);
                }
            }
        }
        return homes;
    }
    async flattenData(rootCID) {
        const rootDir = path.join(this.dataDir, rootCID);
        if (!existsSync(rootDir)) {
            throw new Error(`Root directory not found: ${rootDir}`);
        }
        const files = await fs.readdir(rootDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        const result = {};
        const validFiles = jsonFiles.filter((file) => {
            const cid = path.basename(file, '.json');
            try {
                CID.parse(cid);
                return true;
            }
            catch {
                return false;
            }
        });
        await Promise.all(validFiles.map(async (file) => {
            const cid = path.basename(file, '.json');
            const parsedCid = CID.parse(cid);
            const label = await this.getGroupTitle(parsedCid);
            const content = await fs.readFile(path.join(rootDir.toString(), file.toString()), 'utf-8');
            const data = JSON.parse(content);
            result[label] = await this.traverseLinkedData(data, rootDir);
        }));
        return result;
    }
    async traverseLinkedData(data, baseDir) {
        if (data !== null && typeof data === 'object' && Object.hasOwn(data, '/')) {
            const contentData = await this.readJSONWithCache(path.join(baseDir.toString(), data['/'].toString()));
            return this.traverseLinkedData(contentData, baseDir);
        }
        else if (Array.isArray(data)) {
            return Promise.all(data.map((i) => this.traverseLinkedData(i, baseDir)));
        }
        else if (data !== null && typeof data === 'object') {
            for (const key in data) {
                data[key] = await this.traverseLinkedData(data[key], baseDir);
            }
        }
        return data;
    }
    async readJSONWithCache(path) {
        if (Object.hasOwn(this.fsReadCache, path.toString())) {
            return this.fsReadCache[path.toString()];
        }
        const content = await fs.readFile(path, 'utf-8');
        const data = JSON.parse(content);
        this.fsReadCache[path.toString()] = data;
        return data;
    }
    async getGroupTitle(groupCID) {
        const content = JSON.parse(await this.fetchIPFSContent(groupCID));
        return content.title;
    }
    async fetchIPFSContent(cid) {
        return await (await fetch(`https://ipfs.io/ipfs/${cid.toString()}`)).text();
    }
    transformIPLDData(ipldData) {
        const property = ipldData.property || {};
        const sales = ipldData.sales || [];
        const taxes = ipldData.taxes || [];
        const transformed = {
            property: {
                livable_floor_area: property.sqft?.toString() || '',
                property_type: property.type || '',
                property_structure_built_year: property.yearBuilt || 0,
                parcel_identifier: property.parcelId || '',
                property_legal_description_text: property.legalDescription || '',
                subdivision: property.subdivision || '',
                zoning: property.zoning || '',
                sourceUrl: property.sourceUrl || '',
                source_http_request: property.source_http_request || null,
            },
            address: {
                street_address: property.address || '',
                street_number: property.address?.split(' ')[0] || '',
                street_name: property.address?.split(' ').slice(1, -1).join(' ') || '',
                street_suffix_type: property.address?.split(' ').slice(-1)[0] || '',
                route_number: ipldData.address?.route_number || '',
                city_name: property.city || '',
                state_code: property.state || '',
                county_name: property.county || '',
                postal_code: property.postalCode || '',
                latitude: property.coordinates?.split(',')[0]?.trim() || '',
                longitude: property.coordinates?.split(',')[1]?.trim() || '',
                source_http_request: ipldData.address?.source_http_request || null,
            },
            building: {
                bedrooms: property.beds || 0,
                bathrooms: property.baths || 0,
                property_type: property.type || '',
                year_built: property.yearBuilt || 0,
                living_area: property.sqft || 0,
            },
            lot: {
                lot_size_sqft: typeof property.lotArea === 'string'
                    ? property.lotArea.replace(' sqft', '')
                    : property.lotArea || '',
                lot_type: property.lotType || '',
            },
            sales_history: sales.map((sale) => ({
                date: sale.date,
                amount: sale.price,
            })),
            all_sales: sales.map((sale, _index) => ({
                key: `sales_${_index + 1}`,
                data: {
                    ownership_transfer_date: sale.date,
                    purchase_price_amount: sale.price,
                    source_http_request: sale.source_http_request || null,
                },
                associatedEntity: sale.owner
                    ? {
                        type: 'person',
                        name: sale.owner,
                        data: { person_name: sale.owner },
                    }
                    : null,
            })),
            all_taxes: taxes.map((tax) => ({
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
            appliances: ipldData.appliances,
            carousel_images: ipldData.carousel_images || [],
            layouts: ipldData.layouts
                ? {
                    ...ipldData.layouts,
                    source_http_request: ipldData.layouts.source_http_request || null,
                }
                : [],
            sectionVisibility: ipldData.sectionVisibility,
            dataLabel: ipldData.dataLabel,
            mailing_address: ipldData.mailing_address || null,
            flood_storm_information: ipldData.flood_storm_information || null,
        };
        return transformed;
    }
}
//# sourceMappingURL=data-loader.js.map