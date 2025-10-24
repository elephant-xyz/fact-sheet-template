import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import enumMappingRaw from './data-mapping.json' with { type: 'json' };
import sectionVisibilityRaw from './section-visibility.json' with { type: 'json' };

interface IPLDLink {
  '/': string;
}

interface DataNode {
  cid: string;
  filePath: string;
  data: any;
  relationships: Map<string, DataNode>;
}

interface PropertyInfo {
  address: string;
  city: string;
  state: string;
  county: string;
  postalCode: string;
  coordinates: string;
  parcelId: string;
  beds: number;
  baths: number;
  sqft: number;
  type: string;
  yearBuilt: number;
  legalDescription: string;
  subdivision: string;
  zoning: string;
  lotArea: string;
  lotType: string;
  sourceUrl: string;
  source_http_request?: any;
}

interface SaleInfo {
  date: string;
  price: number;
  owner: string;
}

interface TaxInfo {
  year: number;
  value: number;
}

interface PropertyFeatures {
  interior: EnumInfo[];
  exterior: EnumInfo[];
}

interface CarouselImage {
  ipfs_url: string;
  name?: string;
  document_type?: string;
  file_format?: string;
  source_http_request?: any;
}

interface LayoutInfo {
  space_type: string;
  floor_level: string | number;
  flooring_material_type?: string;
  size_square_feet?: number;
  has_windows?: boolean;
  window_design_type?: string;
  window_material_type?: string;
  window_treatment_type?: string;
  is_finished?: boolean;
  furnished?: boolean;
  paint_condition?: string;
  flooring_wear?: string;
  clutter_level?: string;
  visible_damage?: string;
  countertop_material?: string;
  cabinet_style?: string;
  fixture_finish_quality?: string;
  design_style?: string;
  natural_light_quality?: string;
  decor_elements?: string;
  pool_type?: string;
  pool_equipment?: string;
  spa_type?: string;
  safety_features?: string;
  view_type?: string;
  lighting_features?: string;
  condition_issues?: string;
  is_exterior?: boolean;
  pool_condition?: string;
  pool_surface_type?: string;
  pool_water_quality?: string;
}

export interface LayoutSummary {
  firstFloorLayouts: RenderItem[];
  secondFloorLayouts: RenderItem[];
  otherLayouts: RenderItem[];
  source_http_request?: any;
}

interface SectionVisibility {
  label_to_div_mapping: Record<string, string[]>;
}

export interface PropertyData {
  property: PropertyInfo;
  address?: any;
  mailing_address?: any;
  flood_storm_information?: any;
  sales: SaleInfo[];
  taxes: TaxInfo[];
  features: PropertyFeatures | null;
  structure?: any;
  utility?: any;

  providers?: any[];
  carousel_images?: CarouselImage[];
  layouts?: LayoutSummary;
  sectionVisibility?: SectionVisibility;
  dataLabel?: string;
  appliances: RenderItem[] | null;
}

type EnumMappingRaw = {
  lexiconClass: string;
  lexiconProperty: string;
  iconName: string;
  enumValue: string;
  enumDescription: string;
};

interface EnumInfo {
  enumDescription: string;
  iconName: string | null;
}

type RenderItem = Record<string, EnumInfo>;
type LexiconPropertyMapping = Record<string, RenderItem>;
type EnumMapping = Record<string, LexiconPropertyMapping>;

const EXTERIOR_FEATURE_KEYS: Set<string> = new Set([
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

const INTERIOR_FEATURE_KEYS: Set<string> = new Set([
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
  private cache: Map<string, DataNode> = new Map();
  private dataDir: string;
  private enumMapping: EnumMapping;
  private sectionVisibility: SectionVisibility;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.enumMapping = this.parseEnumMapping(enumMappingRaw as EnumMappingRaw[]);
    this.sectionVisibility = sectionVisibilityRaw as SectionVisibility;
  }

  async loadPropertyData(rootCID: string): Promise<PropertyData> {
    // 1. Load the root directory
    const rootDir = path.join(this.dataDir, rootCID);
    if (!existsSync(rootDir)) {
      throw new Error(`Root directory not found: ${rootDir}`);
    }

    // 2. Build the complete graph
    const graph = await this.buildGraph(rootDir);

    // 3. Transform graph into PropertyData structure
    return this.transformToPropertyData(graph, rootDir, rootCID);
  }

  private parseEnumMapping(mappingRaw: EnumMappingRaw[]): EnumMapping {
    const result: EnumMapping = {};

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

  private async buildGraph(rootDir: string): Promise<Map<string, DataNode>> {
    const graph = new Map<string, DataNode>();
    const visited = new Set<string>();

    // Load all JSON files in the directory
    const files = await fs.readdir(rootDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    // First pass: Load all files and create nodes
    for (const file of jsonFiles) {
      const filePath = path.join(rootDir, file);
      const cid = path.basename(file, '.json');

      if (!visited.has(cid)) {
        const node = await this.loadNode(filePath, cid);
        graph.set(cid, node);
        visited.add(cid);
      }
    }

    // Second pass: Resolve IPLD links
    for (const node of graph.values()) {
      await this.resolveIPLDLinks(node, graph, rootDir);
    }

    return graph;
  }

  private async loadNode(filePath: string, cid: string): Promise<DataNode> {
    // Check cache first
    if (this.cache.has(cid)) {
      return this.cache.get(cid)!;
    }

    // Load file
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Create node
    const node: DataNode = {
      cid,
      filePath,
      data,
      relationships: new Map(),
    };

    // Cache it
    this.cache.set(cid, node);

    return node;
  }

  private async resolveIPLDLinks(
    node: DataNode,
    graph: Map<string, DataNode>,
    _rootDir: string,
  ): Promise<void> {
    const processValue = async (value: any, key: string): Promise<void> => {
      if (this.isIPLDLink(value)) {
        const linkedPath = value['/'];

        if (typeof linkedPath === 'string' && linkedPath.startsWith('./')) {
          // Relative path - resolve to CID
          const fileName = path.basename(linkedPath);
          const cid = path.basename(fileName, '.json');

          // Find the node in the graph
          const linkedNode = graph.get(cid);
          if (linkedNode) {
            node.relationships.set(key, linkedNode);
          }
        } else if (typeof linkedPath === 'string') {
          // Direct CID reference
          const linkedNode = graph.get(linkedPath);
          if (linkedNode) {
            node.relationships.set(key, linkedNode);
          }
        }
      } else if (Array.isArray(value)) {
        // Handle arrays of IPLD links
        for (let i = 0; i < value.length; i++) {
          await processValue(value[i], `${key}[${i}]`);
        }
      } else if (value && typeof value === 'object') {
        // Recursively process nested objects
        for (const [k, v] of Object.entries(value)) {
          await processValue(v, `${key}.${k}`);
        }
      }
    };

    // Process all fields in the data
    for (const [key, value] of Object.entries(node.data)) {
      await processValue(value, key);
    }
  }

  private isIPLDLink(value: any): value is IPLDLink {
    return value && typeof value === 'object' && '/' in value && Object.keys(value).length === 1;
  }

  private async transformToPropertyData(
    graph: Map<string, DataNode>,
    rootDir: string,
    rootCID: string,
  ): Promise<PropertyData> {
    // Find core entities
    const propertyNode =
      this.findNodeByContent(graph, 'parcel_identifier') ||
      this.findNodeByContent(graph, 'parcel_id');
    const addressNode = this.findNodeByContent(graph, 'street_name');
    const salesNodes = this.findNodesByContent(graph, 'purchase_price_amount');
    const taxNodes = this.findNodesByContent(graph, 'tax_year');
    // const personNodes = this.findNodesByContent(graph, 'person_name');
    const lotNode = this.findNodeByContent(graph, 'lot_size_sqft');
    const structureNode = this.findStructureNode(graph);
    const utilityNode = this.findNodeByContent(graph, 'cooling_system_type');
    const unnormalizedAddressNode = this.findNodeByContent(graph, 'full_address');
    const applianceNodes = this.findNodesByContent(graph, 'appliance_type');
    // Find mailing address nodes by looking for nodes with specific mailing address characteristics
    const mailingAddressNodes = Array.from(graph.values()).filter(
      (node) => node.filePath && node.filePath.includes('mailing_address') && node.data.county_name,
    );
    // Find flood storm information node by filename pattern
    const floodStormNode =
      Array.from(graph.values()).find(
        (node) => node.filePath && node.filePath.includes('flood_storm_information'),
      ) ||
      this.findNodeByContent(graph, 'evacuation_zone') ||
      this.findNodeByContent(graph, 'flood_zone');

    const layouts = this.loadLayoutData(graph);

    const property = this.extractPropertyInfo(
      propertyNode,
      addressNode,
      lotNode,
      structureNode,
      layouts,
      unnormalizedAddressNode,
      graph,
      rootCID,
    );

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
        .filter(
          (appliance) =>
            appliance.data.appliance_type !== null && appliance.data.appliance_type !== undefined,
        )
        .map((appliance) => this.convertNodeToRenderItem(appliance, 'appliance'));
    }

    // Determine the data label based on available data
    const dataLabel = this.determineDataLabel(graph, carousel_images);

    // Create address data with source information
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

    // Extract mailing address data
    let mailingAddressData = null;
    if (mailingAddressNodes && mailingAddressNodes.length > 0) {
      // Use the first mailing address node found
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

    // Create sales data with source information
    const salesData = sales.map((sale, index) => ({
      ...sale,
      source_http_request: salesNodes[index]?.data?.source_http_request || null,
    }));

    // Create tax data with source information
    const taxData = taxes.map((tax, index) => ({
      ...tax,
      source_http_request: taxNodes[index]?.data?.source_http_request || null,
    }));

    // Create layout data with source information
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

  private findNodeByContent(graph: Map<string, DataNode>, field: string): DataNode | undefined {
    for (const node of graph.values()) {
      if (node.data && field in node.data) {
        return node;
      }
    }
    return undefined;
  }

  private findNodesByContent(graph: Map<string, DataNode>, field: string): DataNode[] {
    const nodes: DataNode[] = [];
    for (const node of graph.values()) {
      if (node.data && field in node.data) {
        nodes.push(node);
      }
    }
    return nodes;
  }

  private findStructureNode(graph: Map<string, DataNode>): DataNode | undefined {
    // Find all nodes that contain structure-related fields
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

    const structureNodes: DataNode[] = [];

    for (const node of graph.values()) {
      if (!node.data) continue;

      let matchCount = 0;
      for (const field of structureFields) {
        if (field in node.data) {
          matchCount++;
        }
      }

      // Consider it a structure node if it has at least 2 structure fields
      if (matchCount >= 2) {
        structureNodes.push(node);
      }
    }

    if (structureNodes.length === 0) {
      return undefined;
    }

    // If we found multiple structure nodes, merge them into one
    if (structureNodes.length > 1) {
      return this.mergeStructureNodes(structureNodes);
    }

    // If only one structure node, return it
    return structureNodes[0];
  }

  private mergeStructureNodes(nodes: DataNode[]): DataNode {
    // Create a merged data object
    const mergedData: any = {};

    // Merge all data from all structure nodes
    for (const node of nodes) {
      if (node.data) {
        for (const [key, value] of Object.entries(node.data)) {
          // Only add non-null values, or if the key doesn't exist yet
          if (value !== null && value !== undefined) {
            mergedData[key] = value;
          } else if (!(key in mergedData)) {
            mergedData[key] = value;
          }
        }
      }
    }

    // Create a new merged node using the first node's metadata
    const mergedNode: DataNode = {
      cid: nodes[0].cid,
      filePath: nodes[0].filePath,
      data: mergedData,
      relationships: new Map(),
    };

    return mergedNode;
  }

  private extractPropertyInfo(
    propertyNode?: DataNode,
    addressNode?: DataNode,
    lotNode?: DataNode,
    structureNode?: DataNode,
    layoutNodes?: LayoutSummary,
    unnormalizedAddress?: DataNode,
    graph?: Map<string, DataNode>,
    rootCID?: string,
  ): PropertyInfo {
    const propertyData = propertyNode?.data || {};
    const addressData = addressNode?.data || {};
    const lotData = lotNode?.data || {};
    const structureData = structureNode?.data || {};
    let fullAddress = '';
    let coordinates = '';
    if (Object.hasOwn(addressData, 'street_name')) {
      // Extract coordinates from address
      if (addressData.latitude && addressData.longitude) {
        coordinates = `${addressData.latitude}, ${addressData.longitude}`;
      }

      // Build full address from components
      const parts = [];

      if (addressData.street_number) {
        parts.push(addressData.street_number);
      }
      if (addressData.street_pre_directional_text) {
        parts.push(addressData.street_pre_directional_text);
      }
      if (addressData.street_name) {
        // Capitalize street name properly
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
    } else if (unnormalizedAddress?.data) {
      fullAddress = unnormalizedAddress.data.full_address || '';
    }

    // Calculate beds/baths with County preference
    // 1) Prefer County (structure) counts if available
    let beds = 0;
    let baths = 0;

    if (structureData) {
      const structureBeds = parseInt(structureData.structure_rooms_bedroom) || 0;
      const fullBathsFromStructure = parseInt(structureData.structure_rooms_bathroom) || 0;
      const halfBathsFromStructure = parseInt(structureData.structure_rooms_bathroom_half) || 0;
      beds = structureBeds;
      baths = fullBathsFromStructure + halfBathsFromStructure * 0.5;
    }

    // 2) If still missing, derive from County layouts first (relationships with label === 'County')
    if ((beds === 0 || baths === 0) && graph) {
      let bedsFromCounty = 0;
      let bathsFromCounty = 0;
      for (const node of graph.values()) {
        if (node.data?.relationships?.property_has_layout && node.data?.label === 'County') {
          const propertyHasLayoutLinks = node.data.relationships.property_has_layout;
          for (const relationshipLink of propertyHasLayoutLinks) {
            if (this.isIPLDLink(relationshipLink)) {
              const relationshipNode = this.resolveNodeFromLink(relationshipLink, graph);
              if (!relationshipNode?.data?.to) continue;
              const layoutNode = this.resolveNodeFromLink(relationshipNode.data.to, graph);
              const spaceType = layoutNode?.data?.space_type;
              if (spaceType && typeof spaceType === 'string') {
                const lower = spaceType.toLowerCase();
                if (lower.includes('bedroom') || lower.includes('primary bedroom'))
                  bedsFromCounty += 1;
                if (lower.includes('full bathroom')) bathsFromCounty += 1;
                else if (
                  lower.includes('half bathroom') ||
                  lower.includes('half bath') ||
                  lower.includes('powder room')
                )
                  bathsFromCounty += 0.5;
              }
            }
          }
        }
      }
      if (beds === 0 && bedsFromCounty > 0) beds = bedsFromCounty;
      if (baths === 0 && bathsFromCounty > 0) baths = bathsFromCounty;
    }

    // 3) If still missing, derive from root CID folder layouts (scan any relationship files within root set)
    if ((beds === 0 || baths === 0) && graph && rootCID) {
      let bedsFromRoot = 0;
      let bathsFromRoot = 0;
      for (const node of graph.values()) {
        // Consider nodes that live under the same root CID directory
        if (node.filePath && node.filePath.includes(path.sep + rootCID + path.sep)) {
          if (node.data?.to) {
            const layoutNode = this.resolveNodeFromLink(node.data.to, graph);
            const spaceType = layoutNode?.data?.space_type;
            if (spaceType && typeof spaceType === 'string') {
              const lower = spaceType.toLowerCase();
              if (lower.includes('bedroom') || lower.includes('primary bedroom')) bedsFromRoot += 1;
              if (lower.includes('full bathroom')) bathsFromRoot += 1;
              else if (
                lower.includes('half bathroom') ||
                lower.includes('half bath') ||
                lower.includes('powder room')
              )
                bathsFromRoot += 0.5;
            }
          }
        }
      }
      if (beds === 0 && bedsFromRoot > 0) beds = bedsFromRoot;
      if (baths === 0 && bathsFromRoot > 0) baths = bathsFromRoot;
    }

    // 4) If still missing, derive from selected layouts (Photo/County/etc.) as final fallback
    if ((beds === 0 || baths === 0) && layoutNodes) {
      let bedsFromLayouts = 0;
      let bathsFromLayouts = 0;
      for (const layoutGroup of Object.values(layoutNodes)) {
        layoutGroup.forEach((node: RenderItem) => {
          const spaceType = node.space_type;
          if (spaceType) {
            const lowerSpaceType = spaceType.enumDescription.toLowerCase();

            // Count bedrooms
            if (lowerSpaceType.includes('bedroom') || lowerSpaceType.includes('primary bedroom')) {
              bedsFromLayouts += 1;
            }

            // Count bathrooms
            if (lowerSpaceType.includes('full bathroom')) {
              bathsFromLayouts += 1;
            } else if (
              lowerSpaceType.includes('half bathroom') ||
              lowerSpaceType.includes('half bath') ||
              lowerSpaceType.includes('powder room')
            ) {
              bathsFromLayouts += 0.5;
            }
          }
        });
      }
      if (beds === 0) beds = bedsFromLayouts;
      if (baths === 0) baths = bathsFromLayouts;
    }

    const sqft = parseInt(propertyData.livable_floor_area);
    if (!propertyData.source_http_request) {
      throw new Error('Source HTTP request data is missing');
    }
    const {
      url: baseUrl,
      multiValueQueryString = {},
    }: { url: string; multiValueQueryString?: Record<string, string | string[]> } =
      propertyData.source_http_request;
    const url: URL = new URL(baseUrl);
    for (const [key, raw] of Object.entries(multiValueQueryString)) {
      let values: string[];
      if (Array.isArray(raw)) {
        if (!raw.every(v => typeof v === 'string')) {
          throw new Error(`Invalid value for query param "${key}": array contains non-string elements`);
        }
        values = raw;
      } else if (typeof raw === 'string') {
        values = [raw];
      } else {
        throw new Error(`Invalid value for query param "${key}": expected string or array of strings`);
      }
      for (const value of values) {
        url.searchParams.append(key, value);
      }
    }
    // Use enum mapping for address data
    const addressRenderItem = this.buildRenderItem(addressData, 'address');
    const unnormalizedAddressRenderItem = unnormalizedAddress?.data
      ? this.buildRenderItem(unnormalizedAddress.data, 'address')
      : null;

    // Use enum mapping for property data
    const propertyRenderItem = this.buildRenderItem(propertyData, 'property');

    return {
      address: fullAddress || addressData.street_address || '',
      city: addressData.city_name || '',
      state: addressData.state_code || '',
      county:
        addressRenderItem.county_name?.enumDescription ||
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

  private determineLotType(lotSizeSqft?: string): string {
    if (!lotSizeSqft) return '';

    const size = parseInt(lotSizeSqft);
    if (isNaN(size)) return '';

    // 1 acre = 43,560 sqft
    const acreSize = 43560;

    if (size <= acreSize / 4) {
      return 'Less than or equal to 1/4 acre';
    } else if (size <= acreSize / 2) {
      return 'Less than or equal to 1/2 acre';
    } else if (size <= acreSize) {
      return 'Less than or equal to 1 acre';
    } else {
      return 'Greater than 1 acre';
    }
  }

  private extractSalesHistory(salesNodes: DataNode[], graph: Map<string, DataNode>): SaleInfo[] {
    const sales: SaleInfo[] = [];

    for (const saleNode of salesNodes) {
      const saleData = saleNode.data;

      // Find all related persons through relationships
      const ownerNames: string[] = [];

      // Look for relationship files that connect this sale to owners (persons or companies)
      for (const node of graph.values()) {
        // Check if this node has from/to structure typical of relationships
        if (
          node.data &&
          node.data.from &&
          node.data.to &&
          typeof node.data.from === 'object' &&
          typeof node.data.to === 'object'
        ) {
          // Check if this relationship connects to our sale
          const fromLink = node.data.from;
          const toLink = node.data.to;

          if (fromLink && toLink) {
            // Check if this relationship is for our sale
            const saleCid = this.extractCidFromLink(fromLink);
            if (saleCid === saleNode.cid) {
              // Find the owner node (person or company)
              const ownerCid = this.extractCidFromLink(toLink);
              const ownerNode = Array.from(graph.values()).find((n) => n.cid === ownerCid);

              if (ownerNode) {
                // Extract owner name from data - try various field names
                let ownerName = '';

                // Try common person name fields
                if (ownerNode.data.person_name) {
                  // If we have a full name, split it and format as "Last, First"
                  const nameParts = ownerNode.data.person_name.trim().split(' ');
                  if (nameParts.length >= 2) {
                    const lastName = nameParts[0];
                    const firstName = nameParts.slice(1).join(' ');
                    ownerName = `${lastName}, ${firstName}`;
                  } else {
                    ownerName = ownerNode.data.person_name;
                  }
                } else if (ownerNode.data.first_name || ownerNode.data.last_name) {
                  // If we have separate first and last names
                  const firstName = ownerNode.data.first_name || '';
                  const lastName = ownerNode.data.last_name || '';
                  if (firstName && lastName) {
                    ownerName = `${lastName}, ${firstName}`;
                  } else {
                    ownerName = `${firstName}${lastName}`.trim();
                  }
                }
                // Try common company name fields
                else if (ownerNode.data.company_name) {
                  ownerName = ownerNode.data.company_name;
                } else if (ownerNode.data.organization_name) {
                  ownerName = ownerNode.data.organization_name;
                } else if (ownerNode.data.business_name) {
                  ownerName = ownerNode.data.business_name;
                } else if (ownerNode.data.name) {
                  ownerName = ownerNode.data.name;
                }
                // Try any field that might contain a name
                else {
                  // Scan all fields for potential name data
                  for (const [key, value] of Object.entries(ownerNode.data)) {
                    if (
                      typeof value === 'string' &&
                      value.length > 0 &&
                      (key.toLowerCase().includes('name') || key.toLowerCase().includes('title'))
                    ) {
                      ownerName = value;
                      break;
                    }
                  }
                }

                // Add to owners list if not already present
                if (ownerName && !ownerNames.includes(ownerName)) {
                  ownerNames.push(ownerName);
                }
              }
            }
          }
        }
      }

      // Format date
      const date = this.formatDate(saleData.ownership_transfer_date);

      sales.push({
        date,
        price: saleData.purchase_price_amount || 0,
        owner: ownerNames.join('; '), // Join multiple owners with semicolon
      });
    }

    // Sort by date descending
    return sales.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }

  private extractCidFromLink(link: any): string {
    if (this.isIPLDLink(link)) {
      const linkPath = link['/'];
      if (typeof linkPath === 'string' && linkPath.startsWith('./')) {
        return path.basename(linkPath.slice(2), '.json');
      }
      return typeof linkPath === 'string' ? linkPath : '';
    }
    return '';
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';

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

  private extractTaxHistory(taxNodes: DataNode[]): TaxInfo[] {
    const taxes: TaxInfo[] = [];

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

    // Sort by year ascending
    return taxes.sort((a, b) => a.year - b.year);
  }

  private extractFeatures(structureNode: DataNode): PropertyFeatures {
    const features: PropertyFeatures = {
      interior: [],
      exterior: [],
    };
    const renderItem: RenderItem = this.convertNodeToRenderItem(structureNode, 'structure');
    for (const [key, item] of Object.entries(renderItem)) {
      if (EXTERIOR_FEATURE_KEYS.has(key)) {
        features.exterior.push(item);
      } else if (INTERIOR_FEATURE_KEYS.has(key)) {
        features.interior.push(item);
      }
    }

    return features;
  }

  private async loadCarouselImages(
    _rootDir: string,
    graph: Map<string, DataNode>,
  ): Promise<CarouselImage[]> {
    const images: CarouselImage[] = [];

    // Method 1: Find nodes that have relationships.property_has_file
    for (const node of graph.values()) {
      if (node.data?.relationships?.property_has_file) {
        // This node contains property_has_file relationships
        const propertyHasFileLinks = node.data.relationships.property_has_file;

        // Process each relationship link
        for (const relationshipLink of propertyHasFileLinks) {
          if (this.isIPLDLink(relationshipLink)) {
            // Resolve the relationship node
            const relationshipNode = this.resolveNodeFromLink(relationshipLink, graph);

            if (!relationshipNode) {
              continue;
            }

            if (relationshipNode?.data?.to) {
              // Resolve the file metadata node
              const fileNode = this.resolveNodeFromLink(relationshipNode.data.to, graph);

              if (!fileNode) {
                continue;
              }

              // Check if it's an image
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

    // Method 2: If no images found via aggregation, look for relationship nodes directly
    if (images.length === 0) {
      // Find all relationship nodes that match the pattern
      for (const node of graph.values()) {
        if (
          node.cid.startsWith('relationship_property_file_file_') ||
          node.cid.includes('relationship_property_file')
        ) {
          if (node.data?.from && node.data?.to) {
            // Check if this is from property.json
            const fromLink = node.data.from;
            if (this.isIPLDLink(fromLink) && fromLink['/'] === './property.json') {
              // Resolve the file metadata node
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

    // Method 3: Look for *-link.json relationship files (used in photo data)
    if (images.length === 0) {
      for (const node of graph.values()) {
        // Check if the node CID ends with "-link" (indicating a link relationship file)
        if (node.cid.endsWith('-link')) {
          if (node.data?.from && node.data?.to) {
            // Check if this relationship is from a property node
            const toLink = node.data.to;

            // For photo data, the from link might point to a CID rather than a local file
            // We'll accept any link file that points to an image, regardless of the from field
            // since the property relationship might be established through other means

            // Resolve the file metadata node
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

    // Sort images by filename number
    images.sort((a, b) => {
      const numA = parseInt(a.ipfs_url.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.ipfs_url.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    return images;
  }

  private convertNodeToRenderItem(node: DataNode, className: string): RenderItem {
    return this.buildRenderItem(node.data, className);
  }

  private loadLayoutData(graph: Map<string, DataNode>): LayoutSummary {
    const layoutsByDataGroup: Record<string, LayoutInfo[]> = {};

    // Method 1: Find nodes that have relationships.property_has_layout
    for (const node of graph.values()) {
      if (node.data?.relationships?.property_has_layout) {
        // This node contains property_has_layout relationships
        const propertyHasLayoutLinks = node.data.relationships.property_has_layout;

        // Process each relationship link
        for (const relationshipLink of propertyHasLayoutLinks) {
          if (this.isIPLDLink(relationshipLink)) {
            // Resolve the relationship node
            const relationshipNode = this.resolveNodeFromLink(relationshipLink, graph);

            if (!relationshipNode) {
              continue;
            }

            if (relationshipNode?.data?.to) {
              // Resolve the layout node
              const layoutNode = this.resolveNodeFromLink(relationshipNode.data.to, graph);

              if (!layoutNode) {
                continue;
              }

              // Extract layout data
              if (layoutNode?.data?.space_type) {
                (layoutsByDataGroup[node.data.label] ??= []).push(layoutNode.data as LayoutInfo);
              }
            }
          }
        }
      }
    }

    // Method 2: Look for layout nodes directly in the graph (for county level data)
    if (Object.keys(layoutsByDataGroup).length === 0) {
      for (const node of graph.values()) {
        // More flexible check - look for any node that looks like layout data
        if (
          node.data?.space_type ||
          (node.data &&
            typeof node.data === 'object' &&
            ('Bedroom' in node.data ||
              'Bathroom' in node.data ||
              'Kitchen' in node.data ||
              'Living Room' in node.data ||
              'Dining Room' in node.data ||
              'Office' in node.data))
        ) {
          // This looks like a layout node
          const dataGroup = node.data.label || 'County';
          (layoutsByDataGroup[dataGroup] ??= []).push(node.data as LayoutInfo);
        }
      }
    }

    let layouts: LayoutInfo[] = [];

    // Combine all layout data sources, with more specific data taking precedence
    const layoutMap: Map<string, LayoutInfo> = new Map();

    // First, add county layouts (layouts 1-4) as base data
    const countyGroups = ['County', 'county'];
    for (const groupName of countyGroups) {
      if (layoutsByDataGroup[groupName]) {
        for (const layout of layoutsByDataGroup[groupName]) {
          const spaceIndex: any =
            (layout as any)['space_index'] ?? (layout as any)['spaceIndex'] ?? '';
          const key = `${layout.space_type}_${layout.floor_level || 'unknown'}_${spaceIndex}`;
          layoutMap.set(key, layout);
        }
      }
    }

    // Then, layer on batch layout data (more specific data takes precedence)
    const batchGroups = ['Photo Metadata', 'Batch', 'batch'];
    for (const groupName of batchGroups) {
      if (layoutsByDataGroup[groupName]) {
        for (const layout of layoutsByDataGroup[groupName]) {
          const spaceIndex: any =
            (layout as any)['space_index'] ?? (layout as any)['spaceIndex'] ?? '';
          const key = `${layout.space_type}_${layout.floor_level || 'unknown'}_${spaceIndex}`;
          // More specific batch data overwrites county data
          layoutMap.set(key, layout);
        }
      }
    }

    // If no county or batch data found, combine all available data groups
    if (layoutMap.size === 0) {
      for (const [groupName, groupLayouts] of Object.entries(layoutsByDataGroup)) {
        for (const layout of groupLayouts) {
          const spaceIndex: any =
            (layout as any)['space_index'] ?? (layout as any)['spaceIndex'] ?? '';
          const key = `${layout.space_type}_${layout.floor_level || 'unknown'}_${spaceIndex}_${groupName}`;
          layoutMap.set(key, layout);
        }
      }
    }

    layouts = Array.from(layoutMap.values());

    // Check if any layouts have floor level information
    const hasFloorLevels = layouts.some(
      (layout) => layout['floor_level'] && layout['floor_level'] !== null,
    );

    let firstFloorLayouts: any[] = [];
    let secondFloorLayouts: any[] = [];
    let otherLayouts: any[] = [];

    if (hasFloorLevels) {
      // Use floor-based organization when floor level data is available
      firstFloorLayouts = layouts
        .filter((layout) => layout['floor_level'] === '1st Floor')
        .sort((a, b) => a.space_type.localeCompare(b.space_type))
        .map((layout) => this.buildRenderItem(layout, 'layout'));

      secondFloorLayouts = layouts
        .filter((layout) => layout['floor_level'] === '2nd Floor')
        .sort((a, b) => a.space_type.localeCompare(b.space_type))
        .map((layout) => this.buildRenderItem(layout, 'layout'));

      otherLayouts = layouts
        .filter(
          (layout) =>
            layout['floor_level'] !== '1st Floor' && layout['floor_level'] !== '2nd Floor',
        )
        .sort((a, b) => a.space_type.localeCompare(b.space_type))
        .map((layout) => this.buildRenderItem(layout, 'layout'));
    } else {
      // When no floor level data, put all layouts in otherLayouts for single section display
      otherLayouts = layouts
        .sort((a, b) => a.space_type.localeCompare(b.space_type))
        .map((layout) => this.buildRenderItem(layout, 'layout'));
    }

    return {
      firstFloorLayouts,
      secondFloorLayouts,
      otherLayouts,
    };
  }

  private buildRenderItem(item: object, className: string): RenderItem {
    const renderItem: RenderItem = {};
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

  private resolveNodeFromLink(link: any, graph: Map<string, DataNode>): DataNode | undefined {
    if (!this.isIPLDLink(link)) return undefined;

    const linkedPath = link['/'];

    if (linkedPath.startsWith('./')) {
      // Extract the CID from the path
      const fileName = path.basename(linkedPath);
      const cid = path.basename(fileName, '.json');
      return graph.get(cid);
    } else {
      // Direct CID reference
      return graph.get(linkedPath);
    }
  }

  private determineDataLabel(
    graph: Map<string, DataNode>,
    carousel_images: CarouselImage[],
  ): string {
    // First, collect all labels found in the graph
    const labels: string[] = [];
    for (const node of graph.values()) {
      if (node.data && node.data.label) {
        labels.push(node.data.label);
      }
    }

    // Also check for label in any field of any node (case-insensitive)
    for (const node of graph.values()) {
      if (node.data) {
        for (const [key, value] of Object.entries(node.data)) {
          if (key.toLowerCase() === 'label' && typeof value === 'string') {
            labels.push(value);
          }
        }
      }
    }

    // Prioritize labels: Photo Metadata > Photo > County > Seed
    if (labels.includes('Photo Metadata')) {
      return 'Photo Metadata';
    }
    if (labels.includes('Photo')) {
      return 'Photo';
    }
    if (labels.includes('County')) {
      return 'County';
    }
    if (labels.includes('Seed')) {
      return 'Seed';
    }

    // Check for photo metadata (most comprehensive data)
    if (carousel_images.length > 0) {
      return 'Photo Metadata';
    }

    // Check for photo data
    const hasPhotoData = Array.from(graph.values()).some(
      (node) =>
        node.data &&
        (node.data.document_type === 'photo' ||
          node.data.file_format === 'jpg' ||
          node.data.file_format === 'jpeg' ||
          node.data.file_format === 'png'),
    );
    if (hasPhotoData) {
      return 'Photo';
    }

    // Check for county data (sales, taxes, structure details)
    const hasCountyData = Array.from(graph.values()).some(
      (node) =>
        node.data &&
        (node.data.purchase_price_amount ||
          node.data.tax_year ||
          node.data.flooring_material_primary ||
          node.data.exterior_wall_material_primary),
    );
    if (hasCountyData) {
      return 'County';
    }

    // Default to Seed for basic property data
    return 'Seed';
  }
}
