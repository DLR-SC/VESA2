import { Database } from 'arangojs';
import { ArrayCursor } from 'arangojs/cursor';
import {
  IVesaReader,
  IDataset,
  IKeyword,
  IAuthor,
  SearchParams,
  AdapterFeatures,
  AdapterDatasetID,
} from './contracts';
import { db } from '../../database';
import { mainQuery } from '../../queries/mainQuery';
import { keywordQuery } from '../../queries/keywordQuery';
import { authorQuery } from '../../queries/authorQuery';
import { initialPageLoadQuery } from '../../queries/initialLoadQuery';
import processResult from '../../services/Wordcloud/lenghtFiltering';

/**
 * VesaAdapter implements IVesaReader as the local unified graph reader.
 */
export class VesaAdapter implements IVesaReader {
  readonly source = 'vesa';
  private database: Database;

  constructor(database?: Database) {
    this.database = database ?? db;
  }

  async search(_params: SearchParams): Promise<IDataset[]> {
    try {
      const allIds = await this.getAllDatasetIds();
      if (allIds.length === 0) return [];
      return this.getDatasetsByIds(allIds);
    } catch (error) {
      console.error('VesaAdapter.search failed:', error);
      return [];
    }
  }

  async getDatasetById(id: string): Promise<IDataset | null> {
    try {
      const results = await this.getDatasetsByIds([id as AdapterDatasetID]);
      return results[0] ?? null;
    } catch (error) {
      console.error('VesaAdapter.getDatasetById failed:', error);
      return null;
    }
  }

  async getDatasetsByIds(ids: AdapterDatasetID[]): Promise<IDataset[]> {
    if (ids.length === 0) return [];
    try {
      const cursor: ArrayCursor<any> = await this.database.query(mainQuery, { keys: ids });
      const rawResults = await cursor.all();
      return rawResults.filter((r) => r !== null) as IDataset[];
    } catch (error) {
      console.error('VesaAdapter.getDatasetsByIds failed:', error);
      return [];
    }
  }

  async getKeywordsForDatasets(datasetIds: AdapterDatasetID[]): Promise<IKeyword[]> {
    if (datasetIds.length === 0) return [];
    try {
      const cursor: ArrayCursor<any> = await this.database.query(keywordQuery, { keys: datasetIds });
      const rawResults = await cursor.all();
      const processedKeywords = processResult(rawResults);

      return (processedKeywords as any[]).map((k) => ({
        keyword: k.keyword,
        count: k.count,
        dataset_ids: (k.dataset_ids ?? k.dataset_id ?? []) as AdapterDatasetID[],
      }));
    } catch (error) {
      console.error('VesaAdapter.getKeywordsForDatasets failed:', error);
      return [];
    }
  }

  async getAllKeywords(): Promise<IKeyword[]> {
    try {
      const allIds = await this.getAllDatasetIds();
      if (allIds.length === 0) return [];
      return this.getKeywordsForDatasets(allIds);
    } catch (error) {
      console.error('VesaAdapter.getAllKeywords failed:', error);
      return [];
    }
  }

  async getAuthorsForDatasets(datasetIds: AdapterDatasetID[]): Promise<IAuthor[]> {
    if (datasetIds.length === 0) return [];
    try {
      const cursor: ArrayCursor<any> = await this.database.query(authorQuery, { keys: datasetIds });
      const rawResults = await cursor.all();

      return (rawResults as any[]).map((a) => ({
        name: a.name ?? a.author,
        dataset_ids: (a.dataset_ids ?? a.datasets ?? []) as AdapterDatasetID[],
      }));
    } catch (error) {
      console.error('VesaAdapter.getAuthorsForDatasets failed:', error);
      return [];
    }
  }

  async getAllAuthors(): Promise<IAuthor[]> {
    try {
      const allIds = await this.getAllDatasetIds();
      if (allIds.length === 0) return [];
      return this.getAuthorsForDatasets(allIds);
    } catch (error) {
      console.error('VesaAdapter.getAllAuthors failed:', error);
      return [];
    }
  }

  getFeatures(): AdapterFeatures {
    return {
      supportsKeywords: true,
      supportsAuthors: true,
      supportsBboxSearch: false,
      supportsTemporalSearch: false,
      supportsFullTextSearch: false,
      maxResultsPerQuery: 10000,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const cursor = await this.database.query('RETURN 1');
      await cursor.all();
      return true;
    } catch (error) {
      console.error('VesaAdapter.healthCheck failed:', error);
      return false;
    }
  }

  private async getAllDatasetIds(): Promise<AdapterDatasetID[]> {
    try {
      const cursor: ArrayCursor<string> = await this.database.query(initialPageLoadQuery);
      const ids = await cursor.all();
      return ids as AdapterDatasetID[];
    } catch (error) {
      console.error('VesaAdapter.getAllDatasetIds failed:', error);
      return [];
    }
  }
}
