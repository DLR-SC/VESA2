import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  ISyncState,
  ISyncValidateRequest,
  ISyncValidateResponse,
  ISyncStartRequest,
  ISyncStartResponse,
  ISyncStopResponse,
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
    getSyncHistory: builder.query<ISyncHistoryResponse, void>({
      query: () => "sync/history",
      providesTags: ['Sync'],
    }),
  }),
});

export const {
  useValidateUrlMutation,
  useStartSyncMutation,
  useGetSyncStatusQuery,
  useStopSyncMutation,
  useGetSyncHistoryQuery,
} = syncApi;
