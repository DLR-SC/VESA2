import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  ISyncState,
  ISyncValidateRequest,
  ISyncValidateResponse,
  ISyncStartRequest,
  ISyncStartResponse,
  ISyncStopResponse,
  ISyncResumeRequest,
  ISyncResumeResponse,
  ISyncHistoryResponse,
} from "types/appData";

export const syncApi = createApi({
  reducerPath: "syncApi",
  baseQuery: fetchBaseQuery({ baseUrl: import.meta.env.VITE_API_URL }),
  tagTypes: ['Sync'],
  endpoints: (builder) => ({
    validateUrl: builder.mutation<ISyncValidateResponse, ISyncValidateRequest>({
      query: (req) => ({
        url: "sync/validate",
        method: "POST",
        body: req,
      }),
    }),
    startSync: builder.mutation<ISyncStartResponse, ISyncStartRequest>({
      query: (req) => ({
        url: "sync/start",
        method: "POST",
        body: req,
      }),
      invalidatesTags: ['Sync'],
    }),
    getSyncStatus: builder.query<ISyncState, void>({
      query: () => "sync/status",
      providesTags: ['Sync'],
    }),
    stopSync: builder.mutation<ISyncStopResponse, void>({
      query: () => ({
        url: "sync/stop",
        method: "POST",
      }),
      invalidatesTags: ['Sync'],
    }),
    resumeSync: builder.mutation<ISyncResumeResponse, ISyncResumeRequest>({
      query: (req) => ({
        url: "sync/resume",
        method: "POST",
        body: req,
      }),
      invalidatesTags: ['Sync'],
    }),
    getSyncHistory: builder.query<ISyncHistoryResponse, void>({
      query: () => "sync/history",
      providesTags: ['Sync'],
    }),
    deleteSource: builder.mutation<void, string>({
      query: (prefix) => ({
        url: `sync/source/${encodeURIComponent(prefix)}`,
        method: "DELETE",
      }),
      invalidatesTags: ['Sync'],
    }),
  }),
});

export const {
  useValidateUrlMutation,
  useStartSyncMutation,
  useGetSyncStatusQuery,
  useStopSyncMutation,
  useResumeSyncMutation,
  useGetSyncHistoryQuery,
  useDeleteSourceMutation,
} = syncApi;
