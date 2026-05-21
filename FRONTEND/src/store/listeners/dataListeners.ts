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
  clearTimeFilter,
  pushFilter,
  removeFilter,
  popFilter,
  undoFilter,
} from "store/dataset/datasetSlice";
import { updateSelectedKeyword, setSelectedKeyword } from "store/selectedKeyword/selectedKeywordSlice";
import {
  computeTimeDataAsync,
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

// Intersects all active filter dimensions from the filterStack.
// Returns null when the stack is empty (caller should repopulate from cache instead).
function resolveActiveIds(state: RootState): IDatasetID[] | null {
  const { filterStack } = state.dataset;
  if (filterStack.length === 0) return null;
  return filterStack
    .map((e) => e.datasetIds)
    .reduce((acc, ids) => getDatasetIDIntersection(acc, ids));
}

async function repopulateFromCache(api: ListenerApi): Promise<void> {
  const state = api.getState();
  const dsCache   = dataApi.endpoints.getInitialDatasets.select()(state);
  const kwCache   = dataApi.endpoints.getInitialKeywordData.select()(state);
  const authCache = dataApi.endpoints.getInitialAuthorData.select()(state);

  if (dsCache.data?.result) {
    api.dispatch(setDatasetWithGeo(dsCache.data.result));
    api.dispatch(setTimeData(await computeTimeDataAsync(dsCache.data.result)));
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
      api.dispatch(setTimeData(await computeTimeDataAsync(datasetsResult.result)));
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
        api.dispatch(pushFilter({ type: "keyword", label: keyword.keyword, datasetIds: keyword.dataset_id, meta: { keywordData: keyword } }));
        const state = api.getState();
        const ids = resolveActiveIds(state)!;
        const hasGeo = state.dataset.filterStack.some((e) => e.type === "geo");
        await fetchFilteredData(api, ids, { skipGeoData: hasGeo });
      } else {
        api.dispatch(removeFilter("keyword"));
        const state = api.getState();
        const ids = resolveActiveIds(state);
        if (ids !== null) {
          const hasGeo = state.dataset.filterStack.some((e) => e.type === "geo");
          await fetchFilteredData(api, ids, { skipGeoData: hasGeo });
        } else {
          await repopulateFromCache(api);
        }
      }
    },
  });
}

function registerGeoListener(): void {
  // Reacts to both individual point toggles and explicit geo-filter removal (chip bar / GeoFilterCard).
  startAppListening({
    matcher: (action): action is ReturnType<typeof updateSelectedGeoData> | ReturnType<typeof removeFilter> =>
      updateSelectedGeoData.match(action) ||
      (removeFilter.match(action) && action.payload === "geo"),
    effect: async (_, api) => {
      api.cancelActiveListeners();
      const state = api.getState();
      const ids = resolveActiveIds(state);

      if (ids === null) {
        await repopulateFromCache(api);
        return;
      }

      const hasGeo = state.dataset.filterStack.some((e) => e.type === "geo");
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
        const fmtYear = (d: string | null) =>
          d ? new Date(d).getFullYear().toString() : "?";
        api.dispatch(
          pushFilter({
            type: "time",
            label: `${fmtYear(action.payload.start_date)} – ${fmtYear(action.payload.end_date)}`,
            datasetIds: timeIds,
            meta: { timeRange: action.payload },
          })
        );

        const state = api.getState();
        const ids = resolveActiveIds(state);

        if (!ids || ids.length === 0) return;

        await fetchFilteredData(api, ids, { skipTimeData: true });
      } catch {}
    },
  });
}

function registerClearTimeFilterListener(): void {
  startAppListening({
    actionCreator: clearTimeFilter,
    effect: async (_, api) => {
      api.cancelActiveListeners();
      api.dispatch(removeFilter("time"));
      const state = api.getState();
      const ids = resolveActiveIds(state);
      if (ids === null) {
        await repopulateFromCache(api);
        return;
      }
      const hasGeo = state.dataset.filterStack.some((e) => e.type === "geo");
      await fetchFilteredData(api, ids, { skipGeoData: hasGeo });
    },
  });
}

function registerUndoFilterListener(): void {
  startAppListening({
    actionCreator: undoFilter,
    effect: async (_, api) => {
      api.cancelActiveListeners();
      const { filterStack } = api.getState().dataset;
      if (filterStack.length === 0) return;

      const last = filterStack[filterStack.length - 1];
      api.dispatch(popFilter());

      if (last.type === "keyword") {
        // Restore selectedKeyword to the previous keyword in the stack (if any).
        const remaining = api.getState().dataset.filterStack;
        const prevKeyword = [...remaining].reverse().find((e) => e.type === "keyword");
        api.dispatch(setSelectedKeyword(prevKeyword?.meta?.keywordData ?? null));
      }

      const state = api.getState();
      const ids = resolveActiveIds(state);
      if (ids === null) {
        await repopulateFromCache(api);
        return;
      }
      const hasGeo = state.dataset.filterStack.some((e) => e.type === "geo");
      await fetchFilteredData(api, ids, { skipGeoData: hasGeo });
    },
  });
}

export function registerDataListeners(): void {
  registerKeywordListener();
  registerGeoListener();
  registerTimeRangeListener();
  registerClearTimeFilterListener();
  registerUndoFilterListener();
}
