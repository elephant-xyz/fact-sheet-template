import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import enumMappingRaw from './data-mapping.json' with { type: 'json' };
import sectionVisibilityRaw from './section-visibility.json' with { type: 'json' };
const EXTERIOR_FEATURE_KEYS = new Set([
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
    'secondary_framing_material',
]);
const INTERIOR_FEATURE_KEYS = new Set([
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
    'interior_wall_finish_primary',
]);
export class IPLDDataLoader {
    cache = new Map();
    dataDir;
    enumMapping;
    sectionVisibility;
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.enumMapping = this.parseEnumMapping(enumMappingRaw);
        this.sectionVisibility = sectionVisibilityRaw;
    }
    async loadPropertyData(rootCID) {
        const rootDir = path.join(this.dataDir, rootCID);
        if (!existsSync(rootDir)) {
            throw new Error(`Root directory not found: ${rootDir}`);
        }
        const graph = await this.buildGraph(rootDir);
        return this.transformToPropertyData(graph, rootDir, rootCID);
    }
    parseEnumMapping(mappingRaw) {
        const result = {};
        for (const item of mappingRaw) {
            if (!result[item.lexiconClass]) {
                result[item.lexiconClass] = {};
            }
            if (!result[item.lexiconClass][item.lexiconProperty]) {
                result[item.lexiconClass][item.lexiconProperty] = {};
            }
            result[item.lexiconClass][item.lexiconProperty][item.enumValue] = {
                enumDescription: item.enumDescription,
                iconName: `type=${item.iconName}.svg`,
            };
        }
        return result;
    }
    async buildGraph(rootDir) {
        const graph = new Map();
        const visited = new Set();
        const files = await fs.readdir(rootDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        for (const file of jsonFiles) {
            const filePath = path.join(rootDir, file);
            const cid = path.basename(file, '.json');
            if (!visited.has(cid)) {
                const node = await this.loadNode(filePath, cid);
                graph.set(cid, node);
                visited.add(cid);
            }
        }
        for (const node of graph.values()) {
            await this.resolveIPLDLinks(node, graph, rootDir);
        }
        return graph;
    }
    async loadNode(filePath, cid) {
        if (this.cache.has(cid)) {
            return this.cache.get(cid);
        }
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        const node = {
            cid,
            filePath,
            data,
            relationships: new Map(),
        };
        this.cache.set(cid, node);
        return node;
    }
    async resolveIPLDLinks(node, graph, _rootDir) {
        const processValue = async (value, key) => {
            if (this.isIPLDLink(value)) {
                const linkedPath = value['/'];
                if (typeof linkedPath === 'string' && linkedPath.startsWith('./')) {
                    const fileName = path.basename(linkedPath);
                    const cid = path.basename(fileName, '.json');
                    const linkedNode = graph.get(cid);
                    if (linkedNode) {
                        node.relationships.set(key, linkedNode);
                    }
                }
                else if (typeof linkedPath === 'string') {
                    const linkedNode = graph.get(linkedPath);
                    if (linkedNode) {
                        node.relationships.set(key, linkedNode);
                    }
                }
            }
            else if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    await processValue(value[i], `${key}[${i}]`);
                }
            }
            else if (value && typeof value === 'object') {
                for (const [k, v] of Object.entries(value)) {
                    await processValue(v, `${key}.${k}`);
                }
            }
        };
        for (const [key, value] of Object.entries(node.data)) {
            await processValue(value, key);
        }
    }
    isIPLDLink(value) {
        return value && typeof value === 'object' && '/' in value && Object.keys(value).length === 1;
    }
    async transformToPropertyData(graph, rootDir, rootCID) {
        const propertyNode = this.findNodeByContent(graph, 'parcel_identifier') ||
            this.findNodeByContent(graph, 'parcel_id');
        const addressNode = this.findNodeByContent(graph, 'street_name');
        const salesNodes = this.findNodesByContent(graph, 'purchase_price_amount');
        const taxNodes = this.findNodesByContent(graph, 'tax_year');
        const lotNode = this.findNodeByContent(graph, 'lot_size_sqft');
        const structureNode = this.findStructureNode(graph);
        const utilityNode = this.findNodeByContent(graph, 'cooling_system_type');
        const unnormalizedAddressNode = this.findNodeByContent(graph, 'full_address');
        const applianceNodes = this.findNodesByContent(graph, 'appliance_type');
        const mailingAddressNodes = Array.from(graph.values()).filter(node => node.filePath && node.filePath.includes('mailing_address') && node.data.county_name);
        const floodStormNode = Array.from(graph.values()).find(node => node.filePath && node.filePath.includes('flood_storm_information')) || this.findNodeByContent(graph, 'evacuation_zone') || this.findNodeByContent(graph, 'flood_zone');
        const layouts = this.loadLayoutData(graph);
        const property = this.extractPropertyInfo(propertyNode, addressNode, lotNode, structureNode, layouts, unnormalizedAddressNode, graph, rootCID);
        const sales = this.extractSalesHistory(salesNodes, graph);
        const taxes = this.extractTaxHistory(taxNodes);
        let features = null;
        if (structureNode) {
            features = this.extractFeatures(structureNode);
        }
        const carousel_images = await this.loadCarouselImages(rootDir, graph);
        let utility = null;
        if (utilityNode) {
            utility = this.convertNodeToRenderItem(utilityNode, 'utility');
        }
        let appliances = null;
        if (applianceNodes) {
            appliances = applianceNodes
                .filter((appliance) => appliance.data.appliance_type !== null && appliance.data.appliance_type !== undefined)
                .map((appliance) => this.convertNodeToRenderItem(appliance, 'appliance'));
        }
        const dataLabel = this.determineDataLabel(graph, carousel_images);
        const addressData = {
            street_address: property.address,
            street_number: addressNode?.data?.street_number,
            street_name: addressNode?.data?.street_name,
            street_suffix_type: addressNode?.data?.street_suffix_type,
            route_number: addressNode?.data?.route_number,
            city_name: property.city,
            state_code: property.state,
            county_name: property.county,
            postal_code: property.postalCode,
            latitude: addressNode?.data?.latitude,
            longitude: addressNode?.data?.longitude,
            source_http_request: addressNode?.data?.source_http_request || null,
        };
        let mailingAddressData = null;
        if (mailingAddressNodes && mailingAddressNodes.length > 0) {
            const mailingAddressNode = mailingAddressNodes[0];
            if (mailingAddressNode && mailingAddressNode.data.county_name) {
                mailingAddressData = {
                    street_number: mailingAddressNode.data.street_number,
                    street_name: mailingAddressNode.data.street_name,
                    street_suffix_type: mailingAddressNode.data.street_suffix_type,
                    city_name: mailingAddressNode.data.city_name,
                    state_code: mailingAddressNode.data.state_code,
                    county_name: mailingAddressNode.data.county_name,
                    county_jurisdiction: mailingAddressNode.data.county_jurisdiction,
                    county: mailingAddressNode.data.county,
                    postal_code: mailingAddressNode.data.postal_code,
                    country_code: mailingAddressNode.data.country_code,
                    source_http_request: mailingAddressNode.data.source_http_request || null,
                };
            }
        }
        const salesData = sales.map((sale, index) => ({
            ...sale,
            source_http_request: salesNodes[index]?.data?.source_http_request || null,
        }));
        const taxData = taxes.map((tax, index) => ({
            ...tax,
            source_http_request: taxNodes[index]?.data?.source_http_request || null,
        }));
        const layoutData = layouts
            ? {
                ...layouts,
                source_http_request: propertyNode?.data?.source_http_request || null,
            }
            : undefined;
        return {
            property,
            address: addressData,
            mailing_address: mailingAddressData,
            flood_storm_information: floodStormNode?.data || null,
            sales: salesData,
            taxes: taxData,
            features,
            structure: structureNode?.data || null,
            utility,
            carousel_images,
            layouts: layoutData,
            sectionVisibility: this.sectionVisibility,
            dataLabel,
            appliances,
        };
    }
    findNodeByContent(graph, field) {
        for (const node of graph.values()) {
            if (node.data && field in node.data) {
                return node;
            }
        }
        return undefined;
    }
    findNodesByContent(graph, field) {
        const nodes = [];
        for (const node of graph.values()) {
            if (node.data && field in node.data) {
                nodes.push(node);
            }
        }
        return nodes;
    }
    findStructureNode(graph) {
        const structureFields = [
            'flooring_material_primary',
            'flooring_material_secondary',
            'exterior_wall_material_primary',
            'exterior_wall_material_secondary',
            'roof_covering_material',
            'roof_structure_material',
            'interior_wall_surface_material_primary',
            'interior_wall_finish_primary',
            'foundation_type',
            'foundation_material',
            'architectural_style_type',
        ];
        const structureNodes = [];
        for (const node of graph.values()) {
            if (!node.data)
                continue;
            let matchCount = 0;
            for (const field of structureFields) {
                if (field in node.data) {
                    matchCount++;
                }
            }
            if (matchCount >= 2) {
                structureNodes.push(node);
                console.log('Found structure node:', node.cid, 'with', matchCount, 'structure fields');
            }
        }
        if (structureNodes.length === 0) {
            console.log('No structure nodes found');
            return undefined;
        }
        if (structureNodes.length > 1) {
            console.log('Found', structureNodes.length, 'structure nodes, merging data...');
            return this.mergeStructureNodes(structureNodes);
        }
        console.log('Selected single structure node:', structureNodes[0].cid);
        return structureNodes[0];
    }
    mergeStructureNodes(nodes) {
        const mergedData = {};
        for (const node of nodes) {
            if (node.data) {
                for (const [key, value] of Object.entries(node.data)) {
                    if (value !== null && value !== undefined) {
                        mergedData[key] = value;
                    }
                    else if (!(key in mergedData)) {
                        mergedData[key] = value;
                    }
                }
            }
        }
        const mergedNode = {
            cid: nodes[0].cid,
            filePath: nodes[0].filePath,
            data: mergedData,
            relationships: new Map(),
        };
        console.log('Merged structure data with', Object.keys(mergedData).length, 'fields');
        return mergedNode;
    }
    extractPropertyInfo(propertyNode, addressNode, lotNode, structureNode, layoutNodes, unnormalizedAddress, graph, rootCID) {
        const propertyData = propertyNode?.data || {};
        const addressData = addressNode?.data || {};
        const lotData = lotNode?.data || {};
        const structureData = structureNode?.data || {};
        let fullAddress = '';
        let coordinates = '';
        if (Object.hasOwn(addressData, 'street_name')) {
            if (addressData.latitude && addressData.longitude) {
                coordinates = `${addressData.latitude}, ${addressData.longitude}`;
            }
            const parts = [];
            if (addressData.street_number) {
                parts.push(addressData.street_number);
            }
            if (addressData.street_pre_directional_text) {
                parts.push(addressData.street_pre_directional_text);
            }
            if (addressData.street_name) {
                parts.push(addressData.street_name);
            }
            if (addressData.street_suffix_type) {
                parts.push(addressData.street_suffix_type);
            }
            if (addressData.street_post_directional_text) {
                parts.push(addressData.street_post_directional_text);
            }
            fullAddress = parts.join(' ');
            if (addressData.unit_identifier) {
                fullAddress += ` ${addressData.unit_identifier}`;
            }
        }
        else if (unnormalizedAddress?.data) {
            fullAddress = unnormalizedAddress.data.full_address || '';
        }
        let beds = 0;
        let baths = 0;
        if (structureData) {
            const structureBeds = parseInt(structureData.structure_rooms_bedroom) || 0;
            const fullBathsFromStructure = parseInt(structureData.structure_rooms_bathroom) || 0;
            const halfBathsFromStructure = parseInt(structureData.structure_rooms_bathroom_half) || 0;
            beds = structureBeds;
            baths = fullBathsFromStructure + halfBathsFromStructure * 0.5;
        }
        if ((beds === 0 || baths === 0) && graph) {
            let bedsFromCounty = 0;
            let bathsFromCounty = 0;
            for (const node of graph.values()) {
                if (node.data?.relationships?.property_has_layout && node.data?.label === 'County') {
                    const propertyHasLayoutLinks = node.data.relationships.property_has_layout;
                    for (const relationshipLink of propertyHasLayoutLinks) {
                        if (this.isIPLDLink(relationshipLink)) {
                            const relationshipNode = this.resolveNodeFromLink(relationshipLink, graph);
                            if (!relationshipNode?.data?.to)
                                continue;
                            const layoutNode = this.resolveNodeFromLink(relationshipNode.data.to, graph);
                            const spaceType = layoutNode?.data?.space_type;
                            if (spaceType && typeof spaceType === 'string') {
                                const lower = spaceType.toLowerCase();
                                if (lower.includes('bedroom') || lower.includes('primary bedroom'))
                                    bedsFromCounty += 1;
                                if (lower.includes('full bathroom'))
                                    bathsFromCounty += 1;
                                else if (lower.includes('half bathroom') ||
                                    lower.includes('half bath') ||
                                    lower.includes('powder room'))
                                    bathsFromCounty += 0.5;
                            }
                        }
                    }
                }
            }
            if (beds === 0 && bedsFromCounty > 0)
                beds = bedsFromCounty;
            if (baths === 0 && bathsFromCounty > 0)
                baths = bathsFromCounty;
        }
        if ((beds === 0 || baths === 0) && graph && rootCID) {
            let bedsFromRoot = 0;
            let bathsFromRoot = 0;
            for (const node of graph.values()) {
                if (node.filePath && node.filePath.includes(path.sep + rootCID + path.sep)) {
                    if (node.data?.to) {
                        const layoutNode = this.resolveNodeFromLink(node.data.to, graph);
                        const spaceType = layoutNode?.data?.space_type;
                        if (spaceType && typeof spaceType === 'string') {
                            const lower = spaceType.toLowerCase();
                            if (lower.includes('bedroom') || lower.includes('primary bedroom'))
                                bedsFromRoot += 1;
                            if (lower.includes('full bathroom'))
                                bathsFromRoot += 1;
                            else if (lower.includes('half bathroom') ||
                                lower.includes('half bath') ||
                                lower.includes('powder room'))
                                bathsFromRoot += 0.5;
                        }
                    }
                }
            }
            if (beds === 0 && bedsFromRoot > 0)
                beds = bedsFromRoot;
            if (baths === 0 && bathsFromRoot > 0)
                baths = bathsFromRoot;
        }
        if ((beds === 0 || baths === 0) && layoutNodes) {
            let bedsFromLayouts = 0;
            let bathsFromLayouts = 0;
            for (const layoutGroup of Object.values(layoutNodes)) {
                layoutGroup.forEach((node) => {
                    const spaceType = node.space_type;
                    if (spaceType) {
                        const lowerSpaceType = spaceType.enumDescription.toLowerCase();
                        if (lowerSpaceType.includes('bedroom') || lowerSpaceType.includes('primary bedroom')) {
                            bedsFromLayouts += 1;
                        }
                        if (lowerSpaceType.includes('full bathroom')) {
                            bathsFromLayouts += 1;
                        }
                        else if (lowerSpaceType.includes('half bathroom') ||
                            lowerSpaceType.includes('half bath') ||
                            lowerSpaceType.includes('powder room')) {
                            bathsFromLayouts += 0.5;
                        }
                    }
                });
            }
            if (beds === 0)
                beds = bedsFromLayouts;
            if (baths === 0)
                baths = bathsFromLayouts;
        }
        const sqft = parseInt(propertyData.livable_floor_area);
        if (!propertyData.source_http_request) {
            throw new Error('Source HTTP request data is missing');
        }
        const { url: baseUrl, multiValueQueryString, } = propertyData.source_http_request;
        const url = new URL(baseUrl);
        for (const [key, values] of Object.entries(multiValueQueryString)) {
            values.forEach((value) => url.searchParams.append(key, value));
        }
        const addressRenderItem = this.buildRenderItem(addressData, 'address');
        const unnormalizedAddressRenderItem = unnormalizedAddress?.data
            ? this.buildRenderItem(unnormalizedAddress.data, 'address')
            : null;
        const propertyRenderItem = this.buildRenderItem(propertyData, 'property');
        return {
            address: fullAddress || addressData.street_address || '',
            city: addressData.city_name || '',
            state: addressData.state_code || '',
            county: addressRenderItem.county_name?.enumDescription ||
                addressData.county_name ||
                unnormalizedAddressRenderItem?.county_jurisdiction?.enumDescription ||
                unnormalizedAddress?.data?.county_jurisdiction ||
                '',
            postalCode: addressData.postal_code || '',
            coordinates,
            parcelId: propertyData.parcel_identifier,
            beds,
            baths,
            sqft,
            type: propertyRenderItem.property_type?.enumDescription || propertyData.property_type || '',
            yearBuilt: propertyData.property_structure_built_year || '',
            legalDescription: propertyData.property_legal_description_text || '',
            subdivision: propertyData.subdivision || '',
            zoning: propertyData.zoning || '',
            lotArea: lotData.lot_size_sqft ? `${lotData.lot_size_sqft} sqft` : '',
            lotType: this.determineLotType(lotData.lot_size_sqft) || '',
            sourceUrl: url.toString(),
            source_http_request: propertyData.source_http_request || null,
        };
    }
    determineLotType(lotSizeSqft) {
        if (!lotSizeSqft)
            return '';
        const size = parseInt(lotSizeSqft);
        if (isNaN(size))
            return '';
        const acreSize = 43560;
        if (size <= acreSize / 4) {
            return 'Less than or equal to 1/4 acre';
        }
        else if (size <= acreSize / 2) {
            return 'Less than or equal to 1/2 acre';
        }
        else if (size <= acreSize) {
            return 'Less than or equal to 1 acre';
        }
        else {
            return 'Greater than 1 acre';
        }
    }
    extractSalesHistory(salesNodes, graph) {
        const sales = [];
        for (const saleNode of salesNodes) {
            const saleData = saleNode.data;
            const ownerNames = [];
            for (const node of graph.values()) {
                if (node.data &&
                    node.data.from &&
                    node.data.to &&
                    typeof node.data.from === 'object' &&
                    typeof node.data.to === 'object') {
                    const fromLink = node.data.from;
                    const toLink = node.data.to;
                    if (fromLink && toLink) {
                        const saleCid = this.extractCidFromLink(fromLink);
                        if (saleCid === saleNode.cid) {
                            const ownerCid = this.extractCidFromLink(toLink);
                            const ownerNode = Array.from(graph.values()).find((n) => n.cid === ownerCid);
                            if (ownerNode) {
                                let ownerName = '';
                                if (ownerNode.data.person_name) {
                                    const nameParts = ownerNode.data.person_name.trim().split(' ');
                                    if (nameParts.length >= 2) {
                                        const lastName = nameParts[0];
                                        const firstName = nameParts.slice(1).join(' ');
                                        ownerName = `${lastName}, ${firstName}`;
                                    }
                                    else {
                                        ownerName = ownerNode.data.person_name;
                                    }
                                }
                                else if (ownerNode.data.first_name || ownerNode.data.last_name) {
                                    const firstName = ownerNode.data.first_name || '';
                                    const lastName = ownerNode.data.last_name || '';
                                    if (firstName && lastName) {
                                        ownerName = `${lastName}, ${firstName}`;
                                    }
                                    else {
                                        ownerName = `${firstName}${lastName}`.trim();
                                    }
                                }
                                else if (ownerNode.data.company_name) {
                                    ownerName = ownerNode.data.company_name;
                                }
                                else if (ownerNode.data.organization_name) {
                                    ownerName = ownerNode.data.organization_name;
                                }
                                else if (ownerNode.data.business_name) {
                                    ownerName = ownerNode.data.business_name;
                                }
                                else if (ownerNode.data.name) {
                                    ownerName = ownerNode.data.name;
                                }
                                else {
                                    for (const [key, value] of Object.entries(ownerNode.data)) {
                                        if (typeof value === 'string' &&
                                            value.length > 0 &&
                                            (key.toLowerCase().includes('name') || key.toLowerCase().includes('title'))) {
                                            ownerName = value;
                                            break;
                                        }
                                    }
                                }
                                if (ownerName && !ownerNames.includes(ownerName)) {
                                    ownerNames.push(ownerName);
                                }
                            }
                        }
                    }
                }
            }
            const date = this.formatDate(saleData.ownership_transfer_date);
            sales.push({
                date,
                price: saleData.purchase_price_amount || 0,
                owner: ownerNames.join('; '),
            });
        }
        return sales.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB.getTime() - dateA.getTime();
        });
    }
    extractCidFromLink(link) {
        if (this.isIPLDLink(link)) {
            const linkPath = link['/'];
            if (typeof linkPath === 'string' && linkPath.startsWith('./')) {
                return path.basename(linkPath.slice(2), '.json');
            }
            return typeof linkPath === 'string' ? linkPath : '';
        }
        return '';
    }
    formatDate(dateStr) {
        if (!dateStr)
            return '';
        const date = new Date(dateStr);
        const months = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December',
        ];
        return `${months[date.getMonth()]} ${date.getFullYear()}`;
    }
    extractTaxHistory(taxNodes) {
        const taxes = [];
        for (const taxNode of taxNodes) {
            const taxData = taxNode.data;
            const year = taxData.tax_year;
            if (year && taxData.property_taxable_value_amount) {
                taxes.push({
                    year,
                    value: taxData.property_taxable_value_amount || 0,
                });
            }
        }
        return taxes.sort((a, b) => a.year - b.year);
    }
    extractFeatures(structureNode) {
        const features = {
            interior: [],
            exterior: [],
        };
        const renderItem = this.convertNodeToRenderItem(structureNode, 'structure');
        for (const [key, item] of Object.entries(renderItem)) {
            if (EXTERIOR_FEATURE_KEYS.has(key)) {
                features.exterior.push(item);
            }
            else if (INTERIOR_FEATURE_KEYS.has(key)) {
                features.interior.push(item);
            }
        }
        return features;
    }
    async loadCarouselImages(_rootDir, graph) {
        const images = [];
        for (const node of graph.values()) {
            if (node.data?.relationships?.property_has_file) {
                const propertyHasFileLinks = node.data.relationships.property_has_file;
                for (const relationshipLink of propertyHasFileLinks) {
                    if (this.isIPLDLink(relationshipLink)) {
                        const relationshipNode = this.resolveNodeFromLink(relationshipLink, graph);
                        if (!relationshipNode) {
                            continue;
                        }
                        if (relationshipNode?.data?.to) {
                            const fileNode = this.resolveNodeFromLink(relationshipNode.data.to, graph);
                            if (!fileNode) {
                                continue;
                            }
                            if (fileNode?.data?.document_type === 'PropertyImage' && fileNode.data.ipfs_url) {
                                images.push({
                                    ipfs_url: fileNode.data.ipfs_url,
                                    name: fileNode.data.name || '',
                                    document_type: fileNode.data.document_type,
                                    file_format: fileNode.data.file_format,
                                    source_http_request: fileNode.data.source_http_request,
                                });
                            }
                        }
                    }
                }
            }
        }
        if (images.length === 0) {
            for (const node of graph.values()) {
                if (node.cid.startsWith('relationship_property_file_file_') ||
                    node.cid.includes('relationship_property_file')) {
                    if (node.data?.from && node.data?.to) {
                        const fromLink = node.data.from;
                        if (this.isIPLDLink(fromLink) && fromLink['/'] === './property.json') {
                            const fileNode = this.resolveNodeFromLink(node.data.to, graph);
                            if (fileNode?.data?.document_type === 'PropertyImage' && fileNode.data.ipfs_url) {
                                images.push({
                                    ipfs_url: fileNode.data.ipfs_url,
                                    name: fileNode.data.name || '',
                                    document_type: fileNode.data.document_type,
                                    file_format: fileNode.data.file_format,
                                    source_http_request: fileNode.data.source_http_request,
                                });
                            }
                        }
                    }
                }
            }
        }
        if (images.length === 0) {
            for (const node of graph.values()) {
                if (node.cid.endsWith('-link')) {
                    if (node.data?.from && node.data?.to) {
                        const toLink = node.data.to;
                        const fileNode = this.resolveNodeFromLink(toLink, graph);
                        if (fileNode?.data?.document_type === 'PropertyImage' && fileNode.data.ipfs_url) {
                            images.push({
                                ipfs_url: fileNode.data.ipfs_url,
                                name: fileNode.data.name || '',
                                document_type: fileNode.data.document_type,
                                file_format: fileNode.data.file_format,
                                source_http_request: fileNode.data.source_http_request,
                            });
                        }
                    }
                }
            }
        }
        images.sort((a, b) => {
            const numA = parseInt(a.ipfs_url.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.ipfs_url.match(/\d+/)?.[0] || '0');
            return numA - numB;
        });
        return images;
    }
    convertNodeToRenderItem(node, className) {
        return this.buildRenderItem(node.data, className);
    }
    loadLayoutData(graph) {
        const layoutsByDataGroup = {};
        for (const node of graph.values()) {
            if (node.data?.relationships?.property_has_layout) {
                const propertyHasLayoutLinks = node.data.relationships.property_has_layout;
                console.log('Found property_has_layout relationships:', propertyHasLayoutLinks.length);
                for (const relationshipLink of propertyHasLayoutLinks) {
                    if (this.isIPLDLink(relationshipLink)) {
                        const relationshipNode = this.resolveNodeFromLink(relationshipLink, graph);
                        if (!relationshipNode) {
                            console.log('Could not resolve relationship node for:', relationshipLink);
                            continue;
                        }
                        if (relationshipNode?.data?.to) {
                            const layoutNode = this.resolveNodeFromLink(relationshipNode.data.to, graph);
                            if (!layoutNode) {
                                console.log('Could not resolve layout node for:', relationshipNode.data.to);
                                continue;
                            }
                            if (layoutNode?.data?.space_type) {
                                console.log('Loaded layout:', layoutNode.data.space_type);
                                (layoutsByDataGroup[node.data.label] ??= []).push(layoutNode.data);
                            }
                        }
                    }
                }
            }
        }
        if (Object.keys(layoutsByDataGroup).length === 0) {
            console.log('No relationships found, looking for direct layout nodes...');
            for (const node of graph.values()) {
                if (node.data?.space_type ||
                    (node.data && typeof node.data === 'object' &&
                        ('Bedroom' in node.data || 'Bathroom' in node.data || 'Kitchen' in node.data ||
                            'Living Room' in node.data || 'Dining Room' in node.data || 'Office' in node.data))) {
                    console.log('Found potential layout node:', node.data);
                    const dataGroup = node.data.label || 'County';
                    (layoutsByDataGroup[dataGroup] ??= []).push(node.data);
                }
            }
        }
        let layouts = [];
        console.log('Available data groups:', Object.keys(layoutsByDataGroup));
        console.log('Data groups with layout counts:', Object.entries(layoutsByDataGroup).map(([group, layouts]) => `${group}: ${layouts.length} layouts`));
        const layoutMap = new Map();
        const countyGroups = ['County', 'county'];
        for (const groupName of countyGroups) {
            if (layoutsByDataGroup[groupName]) {
                for (const layout of layoutsByDataGroup[groupName]) {
                    const spaceIndex = layout['space_index'] ?? layout['spaceIndex'] ?? '';
                    const key = `${layout.space_type}_${layout.floor_level || 'unknown'}_${spaceIndex}`;
                    layoutMap.set(key, layout);
                }
                console.log(`Added ${layoutsByDataGroup[groupName].length} layouts from ${groupName} group`);
            }
        }
        const batchGroups = ['Photo Metadata', 'Batch', 'batch'];
        for (const groupName of batchGroups) {
            if (layoutsByDataGroup[groupName]) {
                for (const layout of layoutsByDataGroup[groupName]) {
                    const spaceIndex = layout['space_index'] ?? layout['spaceIndex'] ?? '';
                    const key = `${layout.space_type}_${layout.floor_level || 'unknown'}_${spaceIndex}`;
                    layoutMap.set(key, layout);
                }
                console.log(`Layered ${layoutsByDataGroup[groupName].length} layouts from ${groupName} group`);
            }
        }
        if (layoutMap.size === 0) {
            console.log('No county or batch data found, combining all available groups');
            for (const [groupName, groupLayouts] of Object.entries(layoutsByDataGroup)) {
                for (const layout of groupLayouts) {
                    const spaceIndex = layout['space_index'] ?? layout['spaceIndex'] ?? '';
                    const key = `${layout.space_type}_${layout.floor_level || 'unknown'}_${spaceIndex}_${groupName}`;
                    layoutMap.set(key, layout);
                }
                console.log(`Added ${groupLayouts.length} layouts from ${groupName} group`);
            }
        }
        layouts = Array.from(layoutMap.values());
        console.log('Combined layout data from multiple sources:', layouts.length, 'total layouts');
        console.log('Final layouts count:', layouts.length);
        console.log('Final layouts:', layouts.map((l) => l.space_type));
        const hasFloorLevels = layouts.some((layout) => layout['floor_level'] && layout['floor_level'] !== null);
        console.log('Layout processing debug:');
        console.log('  Total layouts found:', layouts.length);
        console.log('  Has floor levels:', hasFloorLevels);
        console.log('  Layout sample:', layouts.slice(0, 3));
        let firstFloorLayouts = [];
        let secondFloorLayouts = [];
        let otherLayouts = [];
        if (hasFloorLevels) {
            firstFloorLayouts = layouts
                .filter((layout) => layout['floor_level'] === '1st Floor')
                .sort((a, b) => a.space_type.localeCompare(b.space_type))
                .map((layout) => this.buildRenderItem(layout, 'layout'));
            secondFloorLayouts = layouts
                .filter((layout) => layout['floor_level'] === '2nd Floor')
                .sort((a, b) => a.space_type.localeCompare(b.space_type))
                .map((layout) => this.buildRenderItem(layout, 'layout'));
            otherLayouts = layouts
                .filter((layout) => layout['floor_level'] !== '1st Floor' && layout['floor_level'] !== '2nd Floor')
                .sort((a, b) => a.space_type.localeCompare(b.space_type))
                .map((layout) => this.buildRenderItem(layout, 'layout'));
            console.log('  Floor-based grouping:', {
                firstFloor: firstFloorLayouts.length,
                secondFloor: secondFloorLayouts.length,
                other: otherLayouts.length
            });
        }
        else {
            console.log('No floor level data found, grouping all layouts together');
            otherLayouts = layouts
                .sort((a, b) => a.space_type.localeCompare(b.space_type))
                .map((layout) => this.buildRenderItem(layout, 'layout'));
            console.log('  Single section grouping:', {
                total: otherLayouts.length
            });
        }
        return {
            firstFloorLayouts,
            secondFloorLayouts,
            otherLayouts,
        };
    }
    buildRenderItem(item, className) {
        const renderItem = {};
        const classMapping = this.enumMapping[className] || {};
        for (const [key, value] of Object.entries(item)) {
            const propertyMapping = classMapping[key];
            if (!propertyMapping) {
                continue;
            }
            const valueMapping = propertyMapping[value];
            if (!valueMapping) {
                continue;
            }
            renderItem[key] = valueMapping;
        }
        return renderItem;
    }
    resolveNodeFromLink(link, graph) {
        if (!this.isIPLDLink(link))
            return undefined;
        const linkedPath = link['/'];
        if (linkedPath.startsWith('./')) {
            const fileName = path.basename(linkedPath);
            const cid = path.basename(fileName, '.json');
            return graph.get(cid);
        }
        else {
            return graph.get(linkedPath);
        }
    }
    determineDataLabel(graph, carousel_images) {
        const labels = [];
        for (const node of graph.values()) {
            if (node.data && node.data.label) {
                console.log('Found explicit label:', node.data.label, 'in node:', node.cid);
                labels.push(node.data.label);
            }
        }
        for (const node of graph.values()) {
            if (node.data) {
                for (const [key, value] of Object.entries(node.data)) {
                    if (key.toLowerCase() === 'label' && typeof value === 'string') {
                        console.log('Found label in field:', key, 'value:', value, 'in node:', node.cid);
                        labels.push(value);
                    }
                }
            }
        }
        if (labels.includes('Photo Metadata')) {
            console.log('Found Photo Metadata label, returning Photo Metadata');
            return 'Photo Metadata';
        }
        if (labels.includes('Photo')) {
            console.log('Found Photo label, returning Photo');
            return 'Photo';
        }
        if (labels.includes('County')) {
            console.log('Found County label, returning County');
            return 'County';
        }
        if (labels.includes('Seed')) {
            console.log('Found Seed label, returning Seed');
            return 'Seed';
        }
        if (carousel_images.length > 0) {
            console.log('No explicit label found, but has carousel images, returning Photo Metadata');
            return 'Photo Metadata';
        }
        const hasPhotoData = Array.from(graph.values()).some((node) => node.data &&
            (node.data.document_type === 'photo' ||
                node.data.file_format === 'jpg' ||
                node.data.file_format === 'jpeg' ||
                node.data.file_format === 'png'));
        if (hasPhotoData) {
            console.log('No explicit label found, but has photo data, returning Photo');
            return 'Photo';
        }
        const hasCountyData = Array.from(graph.values()).some((node) => node.data &&
            (node.data.purchase_price_amount ||
                node.data.tax_year ||
                node.data.flooring_material_primary ||
                node.data.exterior_wall_material_primary));
        if (hasCountyData) {
            console.log('No explicit label found, but has county data, returning County');
            return 'County';
        }
        console.log('No explicit label found, defaulting to Seed');
        return 'Seed';
    }
}
//# sourceMappingURL=ipld-data-loader.js.map