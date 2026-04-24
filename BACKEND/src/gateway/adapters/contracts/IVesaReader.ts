/**
 * IVesaReader - The core interface for the local graph read path.
 *
 * This provides a unified reading interface for runtime queries,
 * abstracting away the underlying local data store.
 *
 * @example
 * ```typescript
 * class VesaGraphReader implements IVesaReader {
 *   readonly source = 'vesa';
 *   // ... implement all methods
 * }
 * ```
 */

import { IDataset, IKeyword, IAuthor, AdapterDatasetID } from './types';
import { SearchParams } from './params';
import { AdapterFeatures } from './features';

export interface IVesaReader {
  /**
   * Unique identifier for this adapter.
   * Used as the prefix in dataset IDs (e.g., "pangaea", "gbif", "openalex", "stac").
   */
  readonly source: string;

  /**
   * Search for datasets matching the given parameters.
   * @param params - Search criteria (query, bbox, dateRange, etc.)
   * @returns Array of datasets matching the search criteria
   */
  search(params: SearchParams): Promise<IDataset[]>;

  /**
   * Get a single dataset by its source-specific ID.
   * @param id - The ID portion after the source prefix (e.g., "123" from "pangaea:123")
   * @returns The dataset if found, null otherwise
   */
  getDatasetById(id: string): Promise<IDataset | null>;

  /**
   * Get multiple datasets by their full adapter IDs.
   * Only returns datasets that belong to this adapter (matching source prefix).
   * @param ids - Array of full dataset IDs (e.g., ["pangaea:123", "pangaea:456"])
   * @returns Array of found datasets
   */
  getDatasetsByIds(ids: AdapterDatasetID[]): Promise<IDataset[]>;

  /**
   * Get keywords associated with specific datasets.
   * @param datasetIds - Array of dataset IDs to get keywords for
   * @returns Array of keywords with counts and associated dataset IDs
   */
  getKeywordsForDatasets(datasetIds: AdapterDatasetID[]): Promise<IKeyword[]>;

  /**
   * Get all keywords from this data source.
   * Used for initial page load to populate the word cloud.
   * @returns Array of all keywords with counts
   */
  getAllKeywords(): Promise<IKeyword[]>;

  /**
   * Get authors associated with specific datasets.
   * @param datasetIds - Array of dataset IDs to get authors for
   * @returns Array of authors with their associated dataset IDs
   */
  getAuthorsForDatasets(datasetIds: AdapterDatasetID[]): Promise<IAuthor[]>;

  /**
   * Get all authors from this data source.
   * Used for initial page load to populate the author network.
   * @returns Array of all authors with their dataset associations
   */
  getAllAuthors(): Promise<IAuthor[]>;

  /**
   * Get the capabilities of this adapter.
   * Services use this to determine what queries are supported.
   * @returns Feature flags indicating adapter capabilities
   */
  getFeatures(): AdapterFeatures;

  /**
   * Check if the adapter's data source is reachable and healthy.
   * Used for health monitoring and graceful degradation.
   * @returns true if the data source is accessible, false otherwise
   */
  healthCheck(): Promise<boolean>;
}
