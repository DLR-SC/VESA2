export interface ISpatial {
  west: number | null;
  east: number | null;
  south: number | null;
  north: number | null;
}

export interface ITemporal {
  start: string | null;
  end: string | null;
}

export interface IDataset {
  id: string;
  title: string;
  abstract: string | null;
  uri: string;
  publicationDate: string | null;
  spatial: ISpatial | null;
  temporal: ITemporal | null;
  source?: string;
}

export interface IAuthor {
  id: string;
  firstName: string;
  lastName: string;
}

export interface IKeyword {
  id: string;
  name: string;
}

export interface IDataAdapter {
  dataset: IDataset;
  authors: IAuthor[];
  keywords: IKeyword[];
}