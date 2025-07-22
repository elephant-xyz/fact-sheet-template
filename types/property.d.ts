export interface Address {
  street_number?: string;
  street_name?: string;
  street_suffix?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  formatted_address?: string;
  source_http_request?: string;
}

export interface Person {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  address?: Address;
}

export interface Company {
  name: string;
  type?: string;
  address?: Address;
  phone?: string;
  email?: string;
}

export interface SalesData {
  ownership_transfer_date?: string;
  sales_date?: string;
  purchase_price_amount?: string | number;
  sales_transaction_amount?: string | number;
  seller_name?: string;
  buyer_name?: string;
  source_http_request?: string;
}

export interface TaxData {
  tax_year?: string | number;
  assessed_value?: string | number;
  tax_amount?: string | number;
  land_value?: string | number;
  improvement_value?: string | number;
  source_http_request?: string;
}

export interface SalesHistoryEntry {
  date: string;
  amount: number;
}

export interface AssociatedEntity {
  type: 'person' | 'company';
  name: string;
  data: Person | Company;
}

export interface SalesEntry {
  key: string;
  data: SalesData;
  associatedEntity: AssociatedEntity | null;
}

export interface TaxEntry {
  key: string;
  data: TaxData;
}

export interface DataSource {
  type: string;
  url: string | null;
  host: string | null;
  full_request: string;
  description: string;
}

export interface PropertyData {
  address?: Address;
  property?: {
    bedrooms?: number;
    bathrooms?: number;
    square_feet?: number;
    lot_size?: number;
    year_built?: number;
    property_type?: string;
    [key: string]: any;
  };
  sales_history: SalesHistoryEntry[];
  all_sales: SalesEntry[];
  all_taxes: TaxEntry[];
  data_sources: DataSource[];
  [key: string]: any; // Allow for dynamic keys like sales_1, tax_1, etc.
}

export interface PropertyCollection {
  [propertyId: string]: PropertyData;
}

export interface BuilderOptions {
  input: string;
  output: string;
  domain?: string;
  inlineCss?: boolean;
  inlineJs?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  ci?: boolean;
  logFile?: string | false;
  dev?: boolean;
}

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
  ci?: boolean;
  logFile?: string | false;
}

export interface LogEntry {
  timestamp: string;
  elapsed: number;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
  [key: string]: any;
}