/**
 * AuthorService - Aggregates author operations across all registered adapters.
 *
 * This service provides a unified interface for author retrieval,
 * aggregating and merging author data from multiple data sources.
 */

import { IAuthor, AdapterDatasetID, IVesaReader } from '../adapters/contracts';

/**
 * AuthorService aggregates author operations from all registered adapters.
 *
 * Note: Not all data sources support author information. The service
 * gracefully handles adapters that don't provide author data.
 *
 * @example
 * ```typescript
 * const service = new AuthorService(registry);
 * const allAuthors = await service.getAllAuthors();
 * const filtered = await service.getAuthorsForDatasets(['pangaea:123']);
 * ```
 */
export class AuthorService {
  constructor(private reader: IVesaReader) {}

  /**
   * Get authors for specific datasets.
   *
   * Routes requests to the appropriate adapters based on dataset ID prefixes.
   *
   * @param datasetIds - Array of dataset IDs
   * @returns Array of authors with their associated dataset IDs
   */
  async getAuthorsForDatasets(datasetIds: AdapterDatasetID[]): Promise<IAuthor[]> {
    if (datasetIds.length === 0) return [];
    if (!this.reader.getFeatures().supportsAuthors) return [];

    try {
      const authors = await this.reader.getAuthorsForDatasets(datasetIds);
      return this.mergeAuthors(authors);
    } catch (error) {
      console.error('AuthorService.getAuthorsForDatasets failed:', error);
      return [];
    }
  }

  /**
   * Get all authors from all adapters.
   *
   * @returns Aggregated and merged array of all authors
   */
  async getAllAuthors(): Promise<IAuthor[]> {
    if (!this.reader.getFeatures().supportsAuthors) return [];

    try {
      const authors = await this.reader.getAllAuthors();
      return this.mergeAuthors(authors);
    } catch (error) {
      console.error('AuthorService.getAllAuthors failed:', error);
      return [];
    }
  }

  /**
   * Merge authors with the same name, combining their dataset IDs.
   *
   * When authors from multiple sources have the same name, this method
   * combines their dataset ID arrays (deduplicating).
   *
   * @param authors - Array of authors (potentially with duplicates)
   * @returns Array of merged authors
   * @private
   */
  private mergeAuthors(authors: IAuthor[]): IAuthor[] {
    const merged = new Map<string, IAuthor>();

    for (const author of authors) {
      const normalizedName = author.name.toLowerCase().trim();
      const existing = merged.get(normalizedName);

      if (existing) {
        // Add new dataset IDs (avoiding duplicates)
        const existingIds = new Set(existing.dataset_ids);
        for (const id of author.dataset_ids) {
          if (!existingIds.has(id)) {
            existing.dataset_ids.push(id);
          }
        }
      } else {
        // Create new entry (preserve original casing from first occurrence)
        merged.set(normalizedName, {
          name: author.name,
          dataset_ids: [...author.dataset_ids],
        });
      }
    }

    // Sort by number of datasets descending (most prolific authors first)
    return Array.from(merged.values()).sort(
      (a, b) => b.dataset_ids.length - a.dataset_ids.length
    );
  }
}
