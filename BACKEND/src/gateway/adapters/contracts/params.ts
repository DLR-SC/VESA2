/**
 * Input parameter types for adapter methods.
 * These define the query contract that services use to request data from adapters.
 */

/**
 * Geographic bounding box for spatial filtering.
 * Coordinates are in WGS84 (standard lat/lon).
 */
export interface BoundingBox {
  /** Western boundary (-180 to 180) */
  west: number;
  /** Southern boundary (-90 to 90) */
  south: number;
  /** Eastern boundary (-180 to 180) */
  east: number;
  /** Northern boundary (-90 to 90) */
  north: number;
}

/**
 * Date range for temporal filtering.
 * Dates should be in ISO 8601 format.
 */
export interface DateRange {
  /** Start date (inclusive) */
  start: string;
  /** End date (inclusive) */
  end: string;
}

/**
 * Search parameters for querying datasets across adapters.
 * All fields are optional - omitted fields mean "no filter".
 */
export interface SearchParams {
  /** Free-text search query */
  query?: string;
  /** Geographic bounding box filter */
  bbox?: BoundingBox;
  /** Temporal range filter */
  dateRange?: DateRange;
  /** Filter by specific keywords */
  keywords?: string[];
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}
