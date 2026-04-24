/**
 * DatasetService - Aggregates dataset operations across all registered adapters.
 *
 * This service provides a unified interface for dataset retrieval,
 * routing requests to the appropriate adapters and aggregating results.
 */

import { IDataset, SearchParams, AdapterDatasetID, IVesaReader } from '../adapters/contracts';

/**
 * DatasetService aggregates dataset operations from all registered adapters.
 *
 * @example
 * ```typescript
 * const service = new DatasetService(registry);
 * const datasets = await service.getAll();
 * const specific = await service.getByIds(['pangaea:123', 'stac:456']);
 * ```
 */
export class DatasetService {
  constructor(private reader: IVesaReader) {}

  /**
   * Search for datasets across all adapters.
   *
   * @param params - Search parameters (query, bbox, dateRange, etc.)
   * @returns Aggregated array of datasets from all adapters
   */
  async search(params: SearchParams): Promise<IDataset[]> {
    try {
      return await this.reader.search(params);
    } catch (error) {
      console.error('DatasetService.search failed:', error);
      return [];
    }
  }

  /**
   * Get datasets by their IDs, routing to the appropriate adapters.
   *
   * IDs are grouped by their source prefix and sent to the corresponding
   * adapter. This ensures efficient batching per adapter.
   *
   * @param ids - Array of dataset IDs (e.g., ['pangaea:123', 'stac:456'])
   * @returns Array of found datasets
   */
  async getByIds(ids: AdapterDatasetID[]): Promise<IDataset[]> {
    if (ids.length === 0) return [];
    try {
      return await this.reader.getDatasetsByIds(ids);
    } catch (error) {
      console.error('DatasetService.getByIds failed:', error);
      return [];
    }
  }

  /**
   * Get a single dataset by ID.
   *
   * @param id - Dataset ID (can be with or without source prefix)
   * @returns The dataset if found, null otherwise
   */
  async getById(id: string): Promise<IDataset | null> {
    try {
      return await this.reader.getDatasetById(id);
    } catch (error) {
      console.error('DatasetService.getById failed:', error);
      return null;
    }
  }

  /**
   * Get all datasets from all adapters.
   *
   * @returns Aggregated array of all datasets
   */
  async getAll(): Promise<IDataset[]> {
    try {
      return await this.reader.search({});
    } catch (error) {
      console.error('DatasetService.getAll failed:', error);
      return [];
    }
  }
}
