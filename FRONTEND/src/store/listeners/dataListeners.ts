import type { ListenerEffectAPI } from "@reduxjs/toolkit";
import { dataApi } from "store/services/dataApi";
import {
  setDataset,
  setDatasetWithGeo,
  setKeywordData,
  setChordData,
  setTimeData,
  setIsFiltering,
  updateSelectedGeoData,
  filterByTimeRange,
  setActiveKeywordFilter,
  clearActiveKeywordFilter,
  setActiveTimeFilter,
} from "store/dataset/datasetSlice";
import { updateSelectedKeyword } from "store/selectedKeyword/selectedKeywordSlice";
import {
  computeTimeData,
  processAuthorData,
  getDatasetID,
  getDatasetIDIntersection,
} from "store/dataset/utility/utility";
import { startAppListening } from "store/listenerMiddleware";
import type { RootState, AppDispatch } from "store";
import type { IDatasetID } from "types/appData";

type ListenerApi = ListenerEffectAPI<RootState, AppDispatch, unknown>;

interface FetchFilteredDataOpts {
  skipGeoData?: boolean;
  skipTimeData?: boolean;
  skipAuthorData?: boolean;
}

// Intersects all active filter dimensions and returns the resulting dataset IDs.
// Returns null when no filter is active (caller should repopulate from cache instead).
// Geo is read from selectedGeoData rather than activeFilters to avoid duplication.
function resolveActiveIds(state: RootState): IDatasetID[] | null {
  const sets: IDatasetID[][] = [];
  if (state.dataset.activeFilters.keyword) sets.push(state.dataset.activeFilters.keyword);
  if (state.dataset.selectedGeoData.length)  sets.push(state.dataset.selectedGeoData);
  if (state.dataset.activeFilters.time)      sets.push(state.dataset.activeFilters.time);
  if (sets.length === 0) return null;
  return sets.reduce((acc, ids) => getDatasetIDIntersection(acc, ids));
}

async function repopulateFromCache(api: ListenerApi): Promise<void> {
  const state = api.getState();
  const dsCache   = dataApi.endpoints.getInitialDatasets.select()(state);
  const kwCache   = dataApi.endpoints.getInitialKeywordData.select()(state);
  const authCache = dataApi.endpoints.getInitialAuthorData.select()(state);

  if (dsCache.data?.result) {
    api.dispatch(setDatasetWithGeo(dsCache.data.result));
    api.dispatch(setTimeData(computeTimeData(dsCache.data.result)));
  }
  if (kwCache.data?.result)   api.dispatch(setKeywordData(kwCache.data.result));
  if (authCache.data?.result) api.dispatch(setChordData(processAuthorData(authCache.data.result)));
}

async function fetchFilteredData(
  api: ListenerApi,
  datasetIds: IDatasetID[],
  opts: FetchFilteredDataOpts = {}
): Promise<void> {
  const { skipGeoData = false, skipTimeData = false, skipAuthorData = false } = opts;

  api.dispatch(setIsFiltering(true));
  try {
    const [keywordsResult, datasetsResult] = await Promise.all([
      api
        .dispatch(dataApi.endpoints.getRelatedKeywordData.initiate({ key: datasetIds }))
        .unwrap(),
      api
        .dispatch(dataApi.endpoints.getRelatedDatasets.initiate({ key: datasetIds }))
        .unwrap(),
    ]);

    api.dispatch(setKeywordData(keywordsResult.result));

    if (skipGeoData) {
      api.dispatch(setDataset(datasetsResult.result));
    } else {
      api.dispatch(setDatasetWithGeo(datasetsResult.result));
    }

    if (!skipTimeData) {
      api.dispatch(setTimeData(computeTimeData(datasetsResult.result)));
    }

    if (!skipAuthorData) {
      const authorResult = await api
        .dispatch(dataApi.endpoints.getAuthorData.initiate({ keys: datasetIds }))
        .unwrap();
      api.dispatch(setChordData(processAuthorData(authorResult.result)));
    }
  } finally {
    api.dispatch(setIsFiltering(false));
  }
}

function registerKeywordListener(): void {
  startAppListening({
    actionCreator: updateSelectedKeyword,
    effect: async (action, api) => {
      api.cancelActiveListeners();
      const keyword = action.payload;

      if (keyword) {
        api.dispatch(setActiveKeywordFilter(keyword.dataset_id));
        const state = api.getState();
        const ids = resolveActiveIds(state)!;
        const hasGeo = state.dataset.selectedGeoData.length > 0;
        await fetchFilteredData(api, ids, { skipGeoData: hasGeo });
      } else {
        api.dispatch(clearActiveKeywordFilter());
        const state = api.getState();
        const ids = resolveActiveIds(state);
        if (ids !== null) {
          const hasGeo = state.dataset.selectedGeoData.length > 0;
          await fetchFilteredData(api, ids, { skipGeoData: hasGeo });
        } else {
          await repopulateFromCache(api);
        }
      }
    },
  });
}

function registerGeoListener(): void {
  startAppListening({
    actionCreator: updateSelectedGeoData,
    effect: async (_, api) => {
      api.cancelActiveListeners();
      const state = api.getState();
      const ids = resolveActiveIds(state);

      if (ids === null) {
        await repopulateFromCache(api);
        return;
      }

      const hasGeo = state.dataset.selectedGeoData.length > 0;
      await fetchFilteredData(api, ids, { skipGeoData: hasGeo });
    },
  });
}

function registerTimeRangeListener(): void {
  startAppListening({
    actionCreator: filterByTimeRange,
    effect: async (action, api) => {
      api.cancelActiveListeners();
      try {
        const timeResult = await api
          .dispatch(
            dataApi.endpoints.getTimeDatasetData.initiate({
              start: action.payload.start_date,
              end: action.payload.end_date,
            })
          )
          .unwrap();

        const timeIds = getDatasetID(timeResult.result);
        api.dispatch(setActiveTimeFilter(timeIds));

        const state = api.getState();
        const ids = resolveActiveIds(state);

        if (!ids || ids.length === 0) return;

        await fetchFilteredData(api, ids, { skipTimeData: true });
      } catch {}
    },
  });
}

export function registerDataListeners(): void {
  registerKeywordListener();
  registerGeoListener();
  registerTimeRangeListener();
}
