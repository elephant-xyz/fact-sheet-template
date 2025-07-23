import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

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
  interior: string[];
  exterior: string[];
}

interface CarouselImage {
  ipfs_url: string;
  name?: string;
  document_type?: string;
  file_format?: string;
}

export interface PropertyData {
  property: PropertyInfo;
  sales: SaleInfo[];
  taxes: TaxInfo[];
  features: PropertyFeatures;
  structure?: any;
  utility?: any;
  providers?: any[];
  carousel_images?: CarouselImage[];
}

export class IPLDDataLoader {
  private cache: Map<string, DataNode> = new Map();
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async loadPropertyData(rootCID: string): Promise<PropertyData> {
    console.log(`Loading property data from CID: ${rootCID}`);

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

        if (linkedPath.startsWith("./")) {
          // Relative path - resolve to CID
          const fileName = path.basename(linkedPath);
          const cid = path.basename(fileName, ".json");

          // Find the node in the graph
          const linkedNode = graph.get(cid);
          if (linkedNode) {
            node.relationships.set(key, linkedNode);
          }
        } else {
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
    const structureNode =
      this.findNodeByContent(graph, "flooring_material_primary") ||
      this.findNodeByContent(graph, "exterior_wall_material_primary") ||
      this.findNodeByContent(graph, "structure_rooms_total");
    const layoutNodes = this.findNodesByContent(graph, "space_type");
    const utilityNode = this.findNodeByContent(graph, "cooling_system_type");
    const unnormalizedAddressNode = this.findNodeByContent(
      graph,
      "full_address",
    );

    // Extract property information with layout data for beds/baths
    const property = this.extractPropertyInfo(
      propertyNode,
      addressNode,
      lotNode,
      structureNode,
      layoutNodes,
      unnormalizedAddressNode,
    );

    // Extract sales history with person information
    const sales = this.extractSalesHistory(salesNodes, graph);

    // Extract tax history
    const taxes = this.extractTaxHistory(taxNodes);

    // Extract features
    const features = this.extractFeatures(
      propertyNode,
      structureNode,
      utilityNode,
    );

    // Load carousel images
    const carousel_images = await this.loadCarouselImages(rootDir, graph);

    return {
      property,
      sales,
      taxes,
      features,
      structure: structureNode?.data || null,
      utility: utilityNode?.data || null,
      carousel_images,
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

  private extractPropertyInfo(
    propertyNode?: DataNode,
    addressNode?: DataNode,
    lotNode?: DataNode,
    structureNode?: DataNode,
    layoutNodes?: DataNode[],
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
        parts.push(this.capitalizeWords(addressData.street_name));
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

    if (layoutNodes && layoutNodes.length > 0) {
      layoutNodes.forEach((node) => {
        const spaceType = node.data.space_type;
        if (spaceType) {
          const lowerSpaceType = spaceType.toLowerCase();

          // Count bedrooms
          if (
            lowerSpaceType.includes("bedroom") ||
            lowerSpaceType.includes("primary bedroom")
          ) {
            beds += 1;
          }

          // Count bathrooms
          if (lowerSpaceType.includes("full bathroom")) {
            baths += 1;
          } else if (
            lowerSpaceType.includes("half bathroom") ||
            lowerSpaceType.includes("half bath")
          ) {
            baths += 0.5;
          }
        }
      });
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
      county: this.capitalizeWords(addressData.county_name) || "",
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

      // Find related person through relationships
      let ownerName = "";

      // Look for relationship files that connect this sale to a person
      for (const node of graph.values()) {
        if (
          node.cid.includes("relationship") &&
          node.cid.includes("sales") &&
          node.cid.includes("person")
        ) {
          // Check if this relationship connects to our sale
          const fromLink = node.data.from;
          const toLink = node.data.to;

          if (fromLink && toLink) {
            // Check if this relationship is for our sale
            const saleCid = this.extractCidFromLink(fromLink);
            if (saleCid === saleNode.cid) {
              // Find the person node
              const personCid = this.extractCidFromLink(toLink);
              const personNode = Array.from(graph.values()).find(
                (n) => n.cid === personCid,
              );

              if (personNode) {
                // Extract person name from data
                if (personNode.data.person_name) {
                  ownerName = personNode.data.person_name;
                } else if (
                  personNode.data.first_name ||
                  personNode.data.last_name
                ) {
                  ownerName =
                    `${personNode.data.first_name || ""} ${personNode.data.last_name || ""}`.trim();
                }
                break;
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
        owner: ownerName,
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
      if (linkPath.startsWith("./")) {
        return path.basename(linkPath.slice(2), ".json");
      }
      return linkPath;
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

  private extractFeatures(
    _propertyNode?: DataNode,
    structureNode?: DataNode,
    utilityNode?: DataNode,
  ): PropertyFeatures {
    const features: PropertyFeatures = {
      interior: [],
      exterior: [],
    };

    // Extract interior features from structure data
    if (structureNode?.data) {
      const data = structureNode.data;

      // Flooring materials
      if (data.flooring_material_primary) {
        features.interior.push(`${data.flooring_material_primary} Flooring`);
      }

      if (data.flooring_material_secondary) {
        features.interior.push(data.flooring_material_secondary);
      }
    }

    // Extract interior features from utility data
    if (utilityNode?.data) {
      const data = utilityNode.data;

      // Cooling system
      if (data.cooling_system_type === "CentralAir") {
        features.interior.push("Central Air");
      }

      // Heating system
      if (data.heating_system_type === "ElectricFurnace") {
        features.interior.push("Electric Heating");
      }
    }

    // Extract exterior features from structure data
    if (structureNode?.data) {
      const data = structureNode.data;

      // Exterior wall materials
      if (data.exterior_wall_material_primary) {
        features.exterior.push(data.exterior_wall_material_primary);
      }

      if (data.exterior_wall_material_secondary) {
        features.exterior.push(data.exterior_wall_material_secondary);
      }

      // Roof material
      if (data.roof_covering_material) {
        features.exterior.push(`${data.roof_covering_material} Roof`);
      }

      // Attachment type
      if (data.attachment_type) {
        features.exterior.push(data.attachment_type);
      }
    }

    return features;
  }

  private async loadCarouselImages(
    _rootDir: string,
    graph: Map<string, DataNode>,
  ): Promise<CarouselImage[]> {
    const images: CarouselImage[] = [];

    // Look for relationship files that indicate property_has_file
    for (const node of graph.values()) {
      if (node.data && node.data.type === "property_has_file") {
        // This is a relationship node
        const fromPath = node.data.from?.path;
        const toPath = node.data.to?.path;

        // Only process if this relationship is from property.json
        if (
          fromPath === "./property.json" &&
          toPath &&
          toPath.startsWith("./file_")
        ) {
          // Extract the file CID from the path
          const fileCid = path.basename(toPath, ".json");
          const fileNode = Array.from(graph.values()).find(
            (n) => n.cid === fileCid,
          );

          if (
            fileNode?.data?.document_type === "image" &&
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

    // Sort images by filename number
    images.sort((a, b) => {
      const numA = parseInt(a.ipfs_url.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.ipfs_url.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

    return images;
  }

  private capitalizeWords(str?: string): string {
    if (!str) return "";
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }
}
