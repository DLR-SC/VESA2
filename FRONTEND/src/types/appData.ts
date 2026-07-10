export interface AppState {
  searchString: string | null;
  handleSearch: (value: string) => void;
}

export type Props = {
  children: React.ReactNode;
};

//this is the interface for the wordcloud data to be transformed into
export interface IWordCloudData {
  text: string;
  value: number;
  year: number; //temp
}

export interface ILocation {
  lat: string;
  lon: string;
}

/** All action types and corresponding payload types are to be defined here */
type UpdateSearch = { type: "UPDATE_SEARCH"; payload: string };

/** The AppActions type would be the union of all above menioned types */
export type AppActions = UpdateSearch;

export interface Action {
  type: string | null;
  payload?: any;
}

export const initialState: AppState = {
  searchString: null,
  handleSearch: () => {},
};

export interface TemporalCoverage {
  start_date: string | null;
  end_date: string | null;
}

export interface FilterEntry {
  type: "keyword" | "time" | "geo";
  label: string;
  datasetIds: IDatasetID[];
  meta?: { timeRange?: TemporalCoverage; keywordData?: IKeywordData };
}

interface LocationData {
  west_bound_longitude: `${number}` | null;
  east_bound_longitude: `${number}` | null;
  north_bound_longitude: `${number}` | null;
  south_bound_longitude: `${number}` | null;
  mean_latitude: `${number}` | null;
  mean_longitude: `${number}` | null;
}

export interface IDataset {
  id: IDatasetID;
  location_data: LocationData;
  doi: IDoi;
  dataset_publication_date?: IPublicationDate;
  temporal_coverage: TemporalCoverage | null;
  authors?: IAuthor[];
  providers?: IProvider[];
  dataset_title: ITitle;
  dataset_source_prefix: string;
}

//Dataset attributes
export type IDatasetID =
  | `Dataset/${IDatasetKEY}`
  | `STACCollection/${IDatasetKEY}`;
export type IDatasetKEY = number | string;
export type IAbstract = string | null;
export type ITitle = string | null;
export type IAuthor = string | null;
export type IProvider = string | null;
export type IDoi = string | null;
export type IPublicationDate = string | null;

export interface IKeywordData {
  keyword: string;
  count: number;
  dataset_id: IDatasetID[];
}

export interface IGeoData {
  id: IDatasetID;
  coordinates: [
    lat: LocationData["mean_latitude"],
    lon: LocationData["mean_longitude"]
  ];
  groupId: string;
}

export interface ITransformedTimeData {
  start: string;
  end: string;
  dataset_title: ITitle;
}
export interface ITimeData {
  date: number | string;
  value: number;
}

export interface AuthorData {
  author: string;
  datasets: IDatasetID[];
}

export interface ChordData {
  from: string;
  to: string;
  value: number;
}

export interface IPointHoverHandler {
  (lat: string, lon: string): void;
}

export interface IContainerProps {
  // height: string;
}

export interface ISyncState {
  status: "running" | "idle" | "failed" | "completed";
  processed: number;
  total: number;
  current_prefix: string;
  job_id?: string;
  error_message?: string;
  target_url?: string;
  source_url?: string;
}

export interface ISyncValidateRequest {
  target_url: string;
  dataset_id: string;
  overwrite?: boolean;
}

export interface ISyncValidateResponse {
  valid: boolean;
  reason?: string;
  message?: string;
  originalStatus?: number;
}

export interface ISyncStartRequest {
  target_url: string;
  dataset_id: string;
  batch_size?: number;
  total_limit?: number;
  overwrite?: boolean;
  inter_batch_sleep_ms?: number;
  ui_config?: Record<string, any>;
}

export interface ISyncStartResponse {
  message: string;
  target_url: string;
  dataset_id: string;
}

export interface ISyncStopResponse {
  message: string;
}

export interface ISyncResumeRequest {
  job_id: string;
}

export interface ISyncResumeResponse {
  message: string;
  job_id: string;
}

export interface ISyncHistoryEntry {
  prefix: string;
  source_url: string;
  count_success: number;
  start_time: string;
  end_time: string;
  ui_config: Record<string, any>;
}

export interface ISyncHistoryResponse {
  result: ISyncHistoryEntry[];
}

// Staging inspection — a read-only sample of a source before ingest.
export interface IExtractedRecord {
  dataset: {
    id: string;
    title: string;
    abstract: string | null;
    uri: string;
    publicationDate: string | null;
    spatial: { west: number | null; east: number | null; south: number | null; north: number | null } | null;
    temporal: { start: string | null; end: string | null } | null;
    source?: string;
  };
  authors: Array<{ id: string; firstName: string; lastName: string }>;
  keywords: Array<{ id: string; name: string }>;
}

export interface IInspectResult {
  source: string;
  selectedPrefix: string;
  discovered: Array<{ prefix: string; rank: 0 | 1 | 3; selected: boolean }>;
  sample: Array<{ raw: any; extracted: IExtractedRecord | null }>;
  fidelity: {
    sampled: number;
    mapPct: number;
    timePct: number;
    abstractPct: number;
    authorsAvg: number;
    keywordsAvg: number;
  };
}
