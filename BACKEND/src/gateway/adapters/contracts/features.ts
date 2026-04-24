/**
 * Adapter capability flags.
 * Each adapter declares what features it supports so that services
 * can make informed decisions about query routing and fallbacks.
 */

export interface AdapterFeatures {
  /** Whether the adapter can provide keyword data for datasets */
  supportsKeywords: boolean;

  /** Whether the adapter can provide author/contributor data */
  supportsAuthors: boolean;

  /** Whether the adapter supports geographic bounding box queries */
  supportsBboxSearch: boolean;

  /** Whether the adapter supports temporal range queries */
  supportsTemporalSearch: boolean;

  /** Whether the adapter supports full-text search */
  supportsFullTextSearch: boolean;

  /** Maximum number of results the adapter can return in a single query */
  maxResultsPerQuery: number;
}
