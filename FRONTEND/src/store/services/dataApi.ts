import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  IDatasetID,
  IDataset,
  IKeywordData,
  TemporalCoverage,
} from "types/appData";

type DatasetResponse = {
  result: IDataset[];
};
interface IAuthorResponse {
  author: string;
  datasets: IDatasetID[];
}
type AuthorDataResponse = {
  result: IAuthorResponse[];
};

type KeywordDataResponse = {
  result: IKeywordData[];
};

type postDataRequestType = {
  key: IDatasetID[];
};

type postAuthorDataRequestType = {
  keys: IDatasetID[];
};

type postTimeDataRequestType = {
  start: TemporalCoverage["start_date"];
  end: TemporalCoverage["end_date"];
};

export const dataApi = createApi({
  reducerPath: "dataApi",
  baseQuery: fetchBaseQuery({ baseUrl: import.meta.env.VITE_API_URL }),
  endpoints: (builder) => ({
    getInitialDatasets: builder.query<DatasetResponse, void>({
      query: () => "main/all",
    }),
    getInitialKeywordData: builder.query<KeywordDataResponse, void>({
      query: () => "keywords/all",
    }),
    getRelatedKeywordData: builder.mutation<KeywordDataResponse, postDataRequestType>({
      query: (req) => ({ url: "keywords/", method: "POST", body: req }),
    }),
    getRelatedDatasets: builder.mutation<DatasetResponse, postDataRequestType>({
      query: (req) => ({ url: "main/", method: "POST", body: req }),
    }),
    getTimeDatasetData: builder.mutation<DatasetResponse, postTimeDataRequestType>({
      query: (req) => ({ url: "time/main", method: "POST", body: req }),
    }),
    getTimeKeywordData: builder.mutation<DatasetResponse, postTimeDataRequestType>({
      query: (req) => ({ url: "time/keywords", method: "POST", body: req }),
    }),
    getInitialAuthorData: builder.query<AuthorDataResponse, void>({
      query: () => "author/all",
    }),
    getAuthorData: builder.mutation<AuthorDataResponse, postAuthorDataRequestType>({
      query: (req) => ({ url: "author/", method: "POST", body: req }),
    }),
  }),
});

export const {
  useGetInitialDatasetsQuery,
  useGetInitialKeywordDataQuery,
  useGetRelatedKeywordDataMutation,
  useGetRelatedDatasetsMutation,
  useGetTimeDatasetDataMutation,
  useGetInitialAuthorDataQuery,
  useGetAuthorDataMutation,
} = dataApi;
