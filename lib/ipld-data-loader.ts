import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";
import enumMappingRaw from "./data-mapping.json" with { type: "json" };
import sectionVisibilityRaw from "./section-visibility.json" with { type: "json" };

interface IPLDLink {
  "/": string;
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
  lotArea: string;
  lotType: string;
  sourceUrl: string;
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
}

interface SectionVisibility {
  label_to_div_mapping: Record<string, string[]>;
}

export interface PropertyData {
  property: PropertyInfo;
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
  "exterior_wall_material_primary",
  "exterior_wall_material_secondary",
  "exterior_wall_insulation_type",
  "roof_covering_material",
  "roof_structure_material",
  "roof_design_type",
  "gutters_material",
  "foundation_type",
  "foundation_material",
  "foundation_waterproofing",
  "exterior_door_material",
  "architectural_style_type",
  "primary_framing_material",
  "secondary_framing_material",
]);

const INTERIOR_FEATURE_KEYS: Set<string> = new Set([
  "flooring_material_primary",
  "flooring_material_secondary",
  "subfloor_material",
  "ceiling_height_average",
  "ceiling_structure_material",
  "ceiling_insulation_type",
  "interior_door_material",
  "window_frame_material",
  "window_glazing_type",
  "window_operation_type",
  "window_screen_material",
  "interior_wall_surface_material_primary",
  "interior_wall_finish_primary",
]);

export class IPLDDataLoader {
  private cache: Map<string, DataNode> = new Map();
  private dataDir: string;
  private enumMapping: EnumMapping;
  private sectionVisibility: SectionVisibility;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.enumMapping = this.parseEnumMapping(
      enumMappingRaw as EnumMappingRaw[],
    );
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
    return this.transformToPropertyData(graph, rootDir);
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
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    // First pass: Load all files and create nodes
    for (const file of jsonFiles) {
      const filePath = path.join(rootDir, file);
      const cid = path.basename(file, ".json");

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
    const content = await fs.readFile(filePath, "utf-8");
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
        const linkedPath = value["/"];

        if (typeof linkedPath === "string" && linkedPath.startsWith("./")) {
          // Relative path - resolve to CID
          const fileName = path.basename(linkedPath);
          const cid = path.basename(fileName, ".json");

          // Find the node in the graph
          const linkedNode = graph.get(cid);
          if (linkedNode) {
            node.relationships.set(key, linkedNode);
          }
        } else if (typeof linkedPath === "string") {
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
      } else if (value && typeof value === "object") {
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
    return (
      value &&
      typeof value === "object" &&
      "/" in value &&
      Object.keys(value).length === 1
    );
  }

  private async transformToPropertyData(
    graph: Map<string, DataNode>,
    rootDir: string,
  ): Promise<PropertyData> {
    // Find core entities
    const propertyNode =
      this.findNodeByContent(graph, "parcel_identifier") ||
      this.findNodeByContent(graph, "parcel_id");
    const addressNode = this.findNodeByContent(graph, "street_name");
    const salesNodes = this.findNodesByContent(graph, "purchase_price_amount");
    const taxNodes = this.findNodesByContent(graph, "tax_year");
    // const personNodes = this.findNodesByContent(graph, 'person_name');
    const lotNode = this.findNodeByContent(graph, "lot_size_sqft");
    const structureNode = this.findStructureNode(graph);
    const utilityNode = this.findNodeByContent(graph, "cooling_system_type");
    const unnormalizedAddressNode = this.findNodeByContent(
      graph,
      "full_address",
    );

    const layouts = this.loadLayoutData(graph);

    const property = this.extractPropertyInfo(
      propertyNode,
      addressNode,
      lotNode,
      structureNode,
      layouts,
      unnormalizedAddressNode,
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
      utility = this.convertNodeToRenderItem(utilityNode, "utility");
    }

    // Determine the data label based on available data
    const dataLabel = this.determineDataLabel(graph, carousel_images);

    return {
      property,
      sales,
      taxes,
      features,
      structure: structureNode?.data || null,
      utility,
      carousel_images,
      layouts,
      sectionVisibility: this.sectionVisibility,
      dataLabel,
    };
  }

  private findNodeByContent(
    graph: Map<string, DataNode>,
    field: string,
  ): DataNode | undefined {
    for (const node of graph.values()) {
      if (node.data && field in node.data) {
        return node;
      }
    }
    return undefined;
  }

  private findNodesByContent(
    graph: Map<string, DataNode>,
    field: string,
  ): DataNode[] {
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
      "flooring_material_primary",
      "flooring_material_secondary", 
      "exterior_wall_material_primary",
      "exterior_wall_material_secondary",
      "roof_covering_material",
      "roof_structure_material",
      "interior_wall_surface_material_primary",
      "interior_wall_finish_primary",
      "foundation_type",
      "foundation_material",
      "architectural_style_type"
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
        console.log('Found structure node:', node.cid, 'with', matchCount, 'structure fields');
      }
    }
    
    if (structureNodes.length === 0) {
      console.log('No structure nodes found');
      return undefined;
    }
    
    // If we found multiple structure nodes, merge them into one
    if (structureNodes.length > 1) {
      console.log('Found', structureNodes.length, 'structure nodes, merging data...');
      return this.mergeStructureNodes(structureNodes);
    }
    
    // If only one structure node, return it
    console.log('Selected single structure node:', structureNodes[0].cid);
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
      relationships: new Map()
    };
    
    console.log('Merged structure data with', Object.keys(mergedData).length, 'fields');
    return mergedNode;
  }

  private extractPropertyInfo(
    propertyNode?: DataNode,
    addressNode?: DataNode,
    lotNode?: DataNode,
    structureNode?: DataNode,
    layoutNodes?: LayoutSummary,
    unnormalizedAddress?: DataNode,
  ): PropertyInfo {
    const propertyData = propertyNode?.data || {};
    const addressData = addressNode?.data || {};
    const lotData = lotNode?.data || {};
    const structureData = structureNode?.data || {};
    let fullAddress = "";
    let coordinates = "";
    if (Object.hasOwn(addressData, "street_name")) {
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
        parts.push((addressData.street_name));
      }
      if (addressData.street_suffix_type) {
        parts.push(addressData.street_suffix_type);
      }
      if (addressData.street_post_directional_text) {
        parts.push(addressData.street_post_directional_text);
      }

      fullAddress = parts.join(" ");

      if (addressData.unit_identifier) {
        fullAddress += `, ${addressData.unit_identifier}`;
      }
    } else if (unnormalizedAddress?.data) {
      fullAddress = unnormalizedAddress.data.full_address || "";
    }

    // Calculate beds/baths from layout data
    let beds = 0;
    let baths = 0;

    if (layoutNodes) {
      for (const layoutGroup of Object.values(layoutNodes)) {
        layoutGroup.forEach((node: RenderItem) => {
          console.log(node);
          const spaceType = node.space_type;
          if (spaceType) {
            const lowerSpaceType = spaceType.enumDescription.toLowerCase();
            console.log('Processing space_type:', spaceType.enumDescription);

            // Count bedrooms
            if (
              lowerSpaceType.includes("bedroom") ||
              lowerSpaceType.includes("primary bedroom")
            ) {
              beds += 1;
            }

            // Count bathrooms
            if (lowerSpaceType.includes("full bathroom")) {
              console.log('Found full bathroom:', spaceType.enumDescription);
              baths += 1;
            } else if (
              lowerSpaceType.includes("half bathroom") ||
              lowerSpaceType.includes("half bath") ||
              lowerSpaceType.includes("powder room")
            ) {
              console.log('Found half bathroom/powder room:', spaceType.enumDescription);
              baths += 0.5;
            } else {
              console.log('Checking bathroom - space_type:', spaceType.enumDescription, 'lowerSpaceType:', lowerSpaceType);
            }
          }
        });
      }
    }

    // Fallback to structure data if no layout data
    if (beds === 0 && structureData.structure_rooms_bedroom) {
      beds = parseInt(structureData.structure_rooms_bedroom) || 0;
    }

    if (baths === 0) {
      const fullBaths = parseInt(structureData.structure_rooms_bathroom) || 0;
      const halfBaths =
        parseInt(structureData.structure_rooms_bathroom_half) || 0;
      baths = fullBaths + halfBaths * 0.5;
    }

    const sqft = parseInt(propertyData.livable_floor_area);
    if (!propertyData.source_http_request) {
      throw new Error("Source HTTP request data is missing");
    }
    const {
      url: baseUrl,
      multiValueQueryString,
    }: { url: string; multiValueQueryString: { [key: string]: string[] } } =
      propertyData.source_http_request;
    const url: URL = new URL(baseUrl);
    for (const [key, values] of Object.entries(multiValueQueryString)) {
      values.forEach((value: string) =>
        url.searchParams.append(key as string, value),
      );
    }
    return {
      address: fullAddress || addressData.street_address || "",
      city: this.capitalizeWords(addressData.city_name) || "",
      state: addressData.state_code || "",
      county: this.capitalizeWords(addressData.county_name) || this.capitalizeWords(unnormalizedAddress?.data?.county_jurisdiction) || "",
      postalCode: addressData.postal_code || "",
      coordinates,
      parcelId: propertyData.parcel_identifier,
      beds,
      baths,
      sqft,
      type: propertyData.property_type || "",
      yearBuilt: propertyData.property_structure_built_year || "",
      legalDescription: propertyData.property_legal_description_text || "",
      lotArea: lotData.lot_size_sqft ? `${lotData.lot_size_sqft} sqft` : "",
      lotType: this.determineLotType(lotData.lot_size_sqft) || "",
      sourceUrl: url.toString(),
    };
  }

  private determineLotType(lotSizeSqft?: string): string {
    if (!lotSizeSqft) return "";

    const size = parseInt(lotSizeSqft);
    if (isNaN(size)) return "";

    // 1 acre = 43,560 sqft
    const acreSize = 43560;

    if (size <= acreSize / 4) {
      return "Less than or equal to 1/4 acre";
    } else if (size <= acreSize / 2) {
      return "Less than or equal to 1/2 acre";
    } else if (size <= acreSize) {
      return "Less than or equal to 1 acre";
    } else {
      return "Greater than 1 acre";
    }
  }

  private extractSalesHistory(
    salesNodes: DataNode[],
    graph: Map<string, DataNode>,
  ): SaleInfo[] {
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
          typeof node.data.from === "object" &&
          typeof node.data.to === "object"
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
              const ownerNode = Array.from(graph.values()).find(
                (n) => n.cid === ownerCid,
              );

              if (ownerNode) {
                // Extract owner name from data - try various field names
                let ownerName = "";
                
                // Try common person name fields
                if (ownerNode.data.person_name) {
                  // If we have a full name, split it and format as "Last, First"
                  const nameParts = ownerNode.data.person_name.trim().split(" ");
                  if (nameParts.length >= 2) {
                    const lastName = nameParts[0];
                    const firstName = nameParts.slice(1).join(" ");
                    ownerName = `${lastName}, ${firstName}`;
                  } else {
                    ownerName = ownerNode.data.person_name;
                  }
                } else if (
                  ownerNode.data.first_name ||
                  ownerNode.data.last_name
                ) {
                  // If we have separate first and last names
                  const firstName = ownerNode.data.first_name || "";
                  const lastName = ownerNode.data.last_name || "";
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
                      typeof value === "string" &&
                      value.length > 0 &&
                      (key.toLowerCase().includes("name") ||
                       key.toLowerCase().includes("title"))
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
        owner: ownerNames.join("; "), // Join multiple owners with semicolon
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
      const linkPath = link["/"];
      if (typeof linkPath === "string" && linkPath.startsWith("./")) {
        return path.basename(linkPath.slice(2), ".json");
      }
      return typeof linkPath === "string" ? linkPath : "";
    }
    return "";
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return "";

    const date = new Date(dateStr);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
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
    const renderItem: RenderItem = this.convertNodeToRenderItem(
      structureNode,
      "structure",
    );
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
            const relationshipNode = this.resolveNodeFromLink(
              relationshipLink,
              graph,
            );

            if (!relationshipNode) {
              continue;
            }

            if (relationshipNode?.data?.to) {
              // Resolve the file metadata node
              const fileNode = this.resolveNodeFromLink(
                relationshipNode.data.to,
                graph,
              );

              if (!fileNode) {
                continue;
              }

              // Check if it's an image
              if (
                fileNode?.data?.document_type === "PropertyImage" &&
                fileNode.data.ipfs_url
              ) {
                images.push({
                  ipfs_url: fileNode.data.ipfs_url,
                  name: fileNode.data.name || "",
                  document_type: fileNode.data.document_type,
                  file_format: fileNode.data.file_format,
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
          node.cid.startsWith("relationship_property_file_file_") ||
          node.cid.includes("relationship_property_file")
        ) {
          if (node.data?.from && node.data?.to) {
            // Check if this is from property.json
            const fromLink = node.data.from;
            if (
              this.isIPLDLink(fromLink) &&
              fromLink["/"] === "./property.json"
            ) {
              // Resolve the file metadata node
              const fileNode = this.resolveNodeFromLink(node.data.to, graph);

              if (
                fileNode?.data?.document_type === "PropertyImage" &&
                fileNode.data.ipfs_url
              ) {
                images.push({
                  ipfs_url: fileNode.data.ipfs_url,
                  name: fileNode.data.name || "",
                  document_type: fileNode.data.document_type,
                  file_format: fileNode.data.file_format,
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
        if (node.cid.endsWith("-link")) {
          if (node.data?.from && node.data?.to) {
            // Check if this relationship is from a property node
            const toLink = node.data.to;
            
            // For photo data, the from link might point to a CID rather than a local file
            // We'll accept any link file that points to an image, regardless of the from field
            // since the property relationship might be established through other means
            
            // Resolve the file metadata node
            const fileNode = this.resolveNodeFromLink(toLink, graph);

            if (
              fileNode?.data?.document_type === "PropertyImage" &&
              fileNode.data.ipfs_url
            ) {
              images.push({
                ipfs_url: fileNode.data.ipfs_url,
                name: fileNode.data.name || "",
                document_type: fileNode.data.document_type,
                file_format: fileNode.data.file_format,
              });
            }
          }
        }
      }
    }

    // Sort images by filename number
    images.sort((a, b) => {
      const numA = parseInt(a.ipfs_url.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.ipfs_url.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

    return images;
  }

  private convertNodeToRenderItem(
    node: DataNode,
    className: string,
  ): RenderItem {
    return this.buildRenderItem(node.data, className);
  }

  private loadLayoutData(graph: Map<string, DataNode>): LayoutSummary {
    const layoutsByDataGroup: Record<string, LayoutInfo[]> = {};
    // Method 1: Find nodes that have relationships.property_has_layout
    for (const node of graph.values()) {
      if (node.data?.relationships?.property_has_layout) {
        // This node contains property_has_layout relationships
        const propertyHasLayoutLinks =
          node.data.relationships.property_has_layout;
        
        console.log('Found property_has_layout relationships:', propertyHasLayoutLinks.length);

        // Process each relationship link
        for (const relationshipLink of propertyHasLayoutLinks) {
          if (this.isIPLDLink(relationshipLink)) {
            // Resolve the relationship node
            const relationshipNode = this.resolveNodeFromLink(
              relationshipLink,
              graph,
            );

            if (!relationshipNode) {
              console.log('Could not resolve relationship node for:', relationshipLink);
              continue;
            }

            if (relationshipNode?.data?.to) {
              // Resolve the layout node
              const layoutNode = this.resolveNodeFromLink(
                relationshipNode.data.to,
                graph,
              );

              if (!layoutNode) {
                console.log('Could not resolve layout node for:', relationshipNode.data.to);
                continue;
              }

              // Extract layout data
              if (layoutNode?.data?.space_type) {
                console.log('Loaded layout:', layoutNode.data.space_type);
                (layoutsByDataGroup[node.data.label] ??= []).push(
                  layoutNode.data as LayoutInfo,
                );
              }
            }
          }
        }
      }
    }

    let layouts: LayoutInfo[] = [];
    console.log('Available data groups:', Object.keys(layoutsByDataGroup));
    console.log('Data groups with layout counts:', Object.entries(layoutsByDataGroup).map(([group, layouts]) => `${group}: ${layouts.length} layouts`));
    
    if (Object.keys(layoutsByDataGroup).length === 1) {
      layouts = layoutsByDataGroup[Object.keys(layoutsByDataGroup)[0]];
      console.log('Selected single data group:', Object.keys(layoutsByDataGroup)[0]);
    } else if (Object.hasOwn(layoutsByDataGroup, "Photo Metadata")) {
      layouts = layoutsByDataGroup["Photo Metadata"];
      console.log('Selected Photo Metadata data group');
    } else {
      if (Object.keys(layoutsByDataGroup).length === 0) {
        layouts = [];
        console.log('No data groups found');
      } else {
        const [_, value] = Object.entries(layoutsByDataGroup).reduce(
          (max, current) => (current[1].length > max[1].length ? current : max),
        );
        layouts = value;
        console.log('Selected largest data group');
      }
    }
    
    console.log('Final layouts count:', layouts.length);
    console.log('Final layouts:', layouts.map(l => l.space_type));

    const firstFloorLayouts = layouts
      .filter((layout) => layout["floor_level"] === "1st Floor")
      .sort((a, b) => a.space_type.localeCompare(b.space_type))
      .map((layout) => this.buildRenderItem(layout, "layout"));

    const secondFloorLayouts = layouts
      .filter((layout) => layout["floor_level"] === "2nd Floor")
      .sort((a, b) => a.space_type.localeCompare(b.space_type))
      .map((layout) => this.buildRenderItem(layout, "layout"));

    const otherLayouts = layouts
      .filter(
        (layout) =>
          layout["floor_level"] !== "1st Floor" &&
          layout["floor_level"] !== "2nd Floor",
      )
      .sort((a, b) => a.space_type.localeCompare(b.space_type))
      .map((layout) => this.buildRenderItem(layout, "layout"));

    return {
      firstFloorLayouts,
      secondFloorLayouts,
      otherLayouts,
    };
  }

  private buildRenderItem(item: Object, className: string): RenderItem {
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

  private capitalizeWords(str?: string): string {
    if (!str) return "";
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  private resolveNodeFromLink(
    link: any,
    graph: Map<string, DataNode>,
  ): DataNode | undefined {
    if (!this.isIPLDLink(link)) return undefined;

    const linkedPath = link["/"];

    if (linkedPath.startsWith("./")) {
      // Extract the CID from the path
      const fileName = path.basename(linkedPath);
      const cid = path.basename(fileName, ".json");
      return graph.get(cid);
    } else {
      // Direct CID reference
      return graph.get(linkedPath);
    }
  }

  private determineDataLabel(graph: Map<string, DataNode>, carousel_images: CarouselImage[]): string {
    // First, collect all labels found in the graph
    const labels: string[] = [];
    for (const node of graph.values()) {
      if (node.data && node.data.label) {
        console.log('Found explicit label:', node.data.label, 'in node:', node.cid);
        labels.push(node.data.label);
      }
    }
    
    // Also check for label in any field of any node (case-insensitive)
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
    
    // Prioritize labels: Photo Metadata > Photo > County > Seed
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
    
    // Check for photo metadata (most comprehensive data)
    if (carousel_images.length > 0) {
      console.log('No explicit label found, but has carousel images, returning Photo Metadata');
      return "Photo Metadata";
    }
    
    // Check for photo data
    const hasPhotoData = Array.from(graph.values()).some(node => 
      node.data && (
        node.data.document_type === "photo" ||
        node.data.file_format === "jpg" ||
        node.data.file_format === "jpeg" ||
        node.data.file_format === "png"
      )
    );
    if (hasPhotoData) {
      console.log('No explicit label found, but has photo data, returning Photo');
      return "Photo";
    }
    
    // Check for county data (sales, taxes, structure details)
    const hasCountyData = Array.from(graph.values()).some(node => 
      node.data && (
        node.data.purchase_price_amount ||
        node.data.tax_year ||
        node.data.flooring_material_primary ||
        node.data.exterior_wall_material_primary
      )
    );
    if (hasCountyData) {
      console.log('No explicit label found, but has county data, returning County');
      return "County";
    }
    
    // Default to Seed for basic property data
    console.log('No explicit label found, defaulting to Seed');
    return "Seed";
  }
}
