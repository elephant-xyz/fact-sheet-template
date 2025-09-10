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
interface EnumInfo {
    enumDescription: string;
    iconName: string | null;
}
type RenderItem = Record<string, EnumInfo>;
export declare class IPLDDataLoader {
    private cache;
    private dataDir;
    private enumMapping;
    private sectionVisibility;
    constructor(dataDir: string);
    loadPropertyData(rootCID: string): Promise<PropertyData>;
    private parseEnumMapping;
    private buildGraph;
    private loadNode;
    private resolveIPLDLinks;
    private isIPLDLink;
    private transformToPropertyData;
    private findNodeByContent;
    private findNodesByContent;
    private findStructureNode;
    private mergeStructureNodes;
    private extractPropertyInfo;
    private determineLotType;
    private extractSalesHistory;
    private extractCidFromLink;
    private formatDate;
    private extractTaxHistory;
    private extractFeatures;
    private loadCarouselImages;
    private convertNodeToRenderItem;
    private loadLayoutData;
    private buildRenderItem;
    private resolveNodeFromLink;
    private determineDataLabel;
}
export {};
//# sourceMappingURL=ipld-data-loader.d.ts.map