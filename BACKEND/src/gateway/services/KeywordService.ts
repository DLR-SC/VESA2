/**
 * KeywordService - Aggregates keyword operations across all registered adapters.
 *
 * This service provides a unified interface for keyword retrieval,
 * aggregating and merging keywords from multiple data sources.
 */

import { IKeyword, AdapterDatasetID, IVesaReader } from '../adapters/contracts';

/**
 * KeywordService aggregates keyword operations from all registered adapters.
 *
 * @example
 * ```typescript
 * const service = new KeywordService(registry);
 * const allKeywords = await service.getAllKeywords();
 * const filtered = await service.getKeywordsForDatasets(['pangaea:123']);
 * ```
 */
export class KeywordService {
  constructor(private reader: IVesaReader) {}

  /**
   * Get keywords for specific datasets.
   *
   * Routes requests to the appropriate adapters based on dataset ID prefixes.
   *
   * @param datasetIds - Array of dataset IDs
   * @returns Array of keywords with counts and associated dataset IDs
   */
  async getKeywordsForDatasets(datasetIds: AdapterDatasetID[]): Promise<IKeyword[]> {
    if (datasetIds.length === 0) return [];

    try {
      const keywords = await this.reader.getKeywordsForDatasets(datasetIds);
      return this.mergeKeywords(keywords);
    } catch (error) {
      console.error('KeywordService.getKeywordsForDatasets failed:', error);
      return [];
    }
  }

  /**
   * Get all keywords from all adapters.
   *
   * @returns Aggregated and merged array of all keywords
   */
  async getAllKeywords(): Promise<IKeyword[]> {
    try {
      const keywords = await this.reader.getAllKeywords();
      return this.mergeKeywords(keywords);
    } catch (error) {
      console.error('KeywordService.getAllKeywords failed:', error);
      return [];
    }
  }

  /**
   * Merge keywords with the same text, combining their counts and dataset IDs.
   *
   * When keywords from multiple sources have the same text, this method:
   * - Sums their counts
   * - Combines their dataset ID arrays (deduplicating)
   *
   * @param keywords - Array of keywords (potentially with duplicates)
   * @returns Array of merged keywords
   * @private
   */
  private mergeKeywords(keywords: IKeyword[]): IKeyword[] {
    const merged = new Map<string, IKeyword>();

    for (const keyword of keywords) {
      const normalizedText = keyword.keyword.toLowerCase().trim();
      const existing = merged.get(normalizedText);

      if (existing) {
        // Merge counts and dataset IDs
        existing.count += keyword.count;

        // Add new dataset IDs (avoiding duplicates)
        const existingIds = new Set(existing.dataset_ids);
        for (const id of keyword.dataset_ids) {
          if (!existingIds.has(id)) {
            existing.dataset_ids.push(id);
          }
        }
      } else {
        // Create new entry (preserve original casing from first occurrence)
        merged.set(normalizedText, {
          keyword: keyword.keyword,
          count: keyword.count,
          dataset_ids: [...keyword.dataset_ids],
        });
      }
    }

    // Sort by count descending
    return Array.from(merged.values()).sort((a, b) => b.count - a.count);
  }
}
