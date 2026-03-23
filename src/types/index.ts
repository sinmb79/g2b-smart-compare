// =============================================================
// G2B Smart Compare — Core TypeScript Types
// =============================================================

// --- Vendor ---

export interface Vendor {
  id: string;
  bizRegNo: string;
  companyName: string;
  ceoName?: string;
  companyType?: string;
  isSme: boolean;
  address?: string;
  regionCode?: string;
  regionName?: string;
  supplyRegions: string[];
  phone?: string;
  email?: string;
  website?: string;
  certifications: Certification[];
  registrationDate?: string; // ISO date
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Certification {
  type: string;      // e.g. "ISO9001", "녹색인증", "여성기업"
  name: string;
  issuedAt?: string; // ISO date
  expiresAt?: string;
}

// --- Product ---

export interface Product {
  id: string;
  g2bProductId: string;
  vendorId?: string;
  vendor?: Vendor;
  productName: string;
  normalizedName?: string;
  categoryCode?: string;
  categoryName?: string;
  unitPrice?: number;
  unit?: string;
  spec?: string;
  parsedSpec: ParsedSpec;
  manufacturer?: string;
  origin?: string;
  deliveryDays?: number;
  minOrderQty: number;
  isActive: boolean;
  g2bUrl?: string;
  activityScore?: number;       // from vendor_activity
  referencePrice?: ReferencePrice;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

export interface ParsedSpec {
  brand?: string;
  model?: string;
  capacity?: string;
  size?: string;
  weight?: string;
  color?: string;
  material?: string;
  [key: string]: string | undefined;
}

// --- Vendor Activity Score ---

export interface VendorActivity {
  id: string;
  vendorId: string;
  totalScore: number;             // 0–100 (참고 지표)
  deliveryCountScore: number;     // 0–35
  amountScore: number;            // 0–25
  certificationScore: number;     // 0–20
  contractDurationScore: number;  // 0–15
  smeBonus: number;               // 0–5
  deliveryCount3yr: number;
  totalAmount3yr: number;
  activeContractMonths: number;
  certificationCount: number;
  scoreVersion: string;
  calculatedAt: string;
}

// --- Price Reference ---

export interface ReferencePrice {
  id: string;
  productId: string;
  price: number;
  priceMin?: number;
  priceMax?: number;
  sellerCount?: number;
  source: "naver" | "danawa" | "coupang";
  matchScore: number;       // TF-IDF similarity (must be >= 0.7 to display)
  externalName?: string;
  externalUrl?: string;
  fetchedAt: string;
  isBeta: true;             // Always beta — never remove this flag
}

// --- Product Mapping ---

export interface ProductMapping {
  id: string;
  productId: string;
  externalId: string;
  externalSource: "naver" | "danawa" | "coupang";
  matchMethod: "tfidf" | "semantic" | "manual";
  matchScore: number;       // 0.0–1.0
  externalName?: string;
  externalUrl?: string;
  isConfirmed: boolean;
}

// --- Search ---

export interface SearchParams {
  query: string;
  categoryCode?: string;
  regionCode?: string;
  supplyRegion?: string;
  isSme?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "activity_score" | "newest";
  page: number;
  pageSize: number;
}

export interface SearchResult {
  products: ProductSearchHit[];
  total: number;
  page: number;
  pageSize: number;
  took: number;   // ms
  query: string;
}

export interface ProductSearchHit {
  id: string;
  g2bProductId: string;
  productName: string;
  categoryName?: string;
  unitPrice?: number;
  unit?: string;
  vendorName?: string;
  vendorId?: string;
  regionName?: string;
  activityScore?: number;
  hasReferencePrice: boolean;
  score: number;  // ES relevance score
}

// --- ETL ---

export interface EtlRunLog {
  id: string;
  runType: string;
  source?: string;
  status: "running" | "success" | "failed" | "partial";
  startedAt: string;
  finishedAt?: string;
  recordsTotal: number;
  recordsOk: number;
  recordsFailed: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}

export interface EtlStatus {
  isStale: boolean;
  lastSuccessfulRun?: string;  // ISO datetime
  hoursAgo?: number;
}

// --- API Response wrappers ---

export interface ApiResponse<T> {
  data: T;
  meta?: {
    lastUpdatedAt?: string;
    isStale?: boolean;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// --- Compare tray (localStorage only — never sent to server) ---

export interface CompareTrayItem {
  productId: string;
  productName: string;
  unitPrice?: number;
  vendorName?: string;
  addedAt: string;
}
