/**
 * Core domain types for the Adapter-Registry Model.
 * These types define the contract that all adapters must produce,
 * independent of any specific data source.
 */

/**
 * Source-agnostic dataset ID format.
 * Format: "{source}:{id}" (e.g., "pangaea:123", "gbif:456", "stac:789")
 */
export type AdapterDatasetID = `${string}:${string}`;

/**
 * Geographic location data for a dataset.
 * Supports both bounding box and centroid coordinates.
 */
export interface ILocation {
  /** Western boundary longitude (-180 to 180) */
  west_bound_longitude: number | null;
  /** Eastern boundary longitude (-180 to 180) */
  east_bound_longitude: number | null;
  /** Northern boundary latitude (-90 to 90) */
  north_bound_latitude: number | null;
  /** Southern boundary latitude (-90 to 90) */
  south_bound_latitude: number | null;
  /** Mean/centroid latitude */
  mean_latitude: number | null;
  /** Mean/centroid longitude */
  mean_longitude: number | null;
}

/**
 * Temporal coverage of a dataset.
 * Dates should be in ISO 8601 format (YYYY-MM-DD or full datetime).
 */
export interface ITemporalCoverage {
  /** Start date of temporal coverage */
  start_date: string | null;
  /** End date of temporal coverage */
  end_date: string | null;
}

/**
 * A normalized dataset representation that all adapters must produce.
 * This is the core domain entity for scientific datasets.
 */
export interface IDataset {
  /** Unique identifier in format "{source}:{id}" */
  id: AdapterDatasetID;
  /** Geographic location and bounds */
  location_data: ILocation;
  /** Digital Object Identifier or URL */
  doi: string | null;
  /** Date the dataset was published */
  dataset_publication_date?: string | null;
  /** Temporal coverage of the data within the dataset */
  temporal_coverage: ITemporalCoverage;
  /** List of author names (for datasets that support authorship) */
  authors?: string[];
  /** List of data provider names (for datasets that use providers instead of authors) */
  providers?: string[];
  /** Human-readable title of the dataset */
  dataset_title: string | null;
  /** Source dataset prefix/repository name (e.g., "PANGAEA", "GBIF", "OpenAlex") */
  dataset_source_prefix: string;
}

/**
 * A keyword/term associated with datasets, including occurrence count.
 * Used for word cloud visualization and filtering.
 */
export interface IKeyword {
  /** The keyword or term text */
  keyword: string;
  /** Occurrence count or TF-IDF score (depending on processing stage) */
  count: number;
  /** List of dataset IDs that contain this keyword */
  dataset_ids: AdapterDatasetID[];
}

/**
 * An author and their associated datasets.
 * Used for author network visualization.
 */
export interface IAuthor {
  /** Author's display name */
  name: string;
  /** List of dataset IDs authored by this person */
  dataset_ids: AdapterDatasetID[];
}
