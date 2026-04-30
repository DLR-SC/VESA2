import type { ListenerEffectAPI } from "@reduxjs/toolkit";
import { dataApi } from "store/services/dataApi";
import {
  setDataset,
  setDatasetWithGeo,
  setKeywordData,
  setChordData,
  setTimeData,
  setIsFiltering,
  resetDatasetSlice,
  updateSelectedGeoData,
  filterByTimeRange,
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

async function repopulateFromCache(api: ListenerApi): Promise<void> {
  const state = api.getState();
  const dsCache = dataApi.endpoints.getInitialDatasets.select()(state);
  const kwCache = dataApi.endpoints.getInitialKeywordData.select()(state);
  const authCache = dataApi.endpoints.getInitialAuthorData.select()(state);

  if (dsCache.data?.result) {
    api.dispatch(setDatasetWithGeo(dsCache.data.result));
    api.dispatch(setTimeData(computeTimeData(dsCache.data.result)));
  }
  if (kwCache.data?.result) {
    api.dispatch(setKeywordData(kwCache.data.result));
  }
  if (authCache.data?.result) {
    api.dispatch(setChordData(processAuthorData(authCache.data.result)));
  }
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
        await fetchFilteredData(api, keyword.dataset_id);
      } else {
        api.dispatch(resetDatasetSlice());
        await repopulateFromCache(api);
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
      const selectedGeoData = state.dataset.selectedGeoData;
      const keyword = state.selectedKeyword.selectedKeyword;

      if (selectedGeoData.length === 0 && !keyword) {
        return;
      }

      let ids: IDatasetID[];
      if (selectedGeoData.length > 0) {
        ids = keyword
          ? getDatasetIDIntersection(selectedGeoData, keyword.dataset_id)
          : selectedGeoData;
      } else {
        ids = keyword!.dataset_id;
      }

      await fetchFilteredData(api, ids, { skipGeoData: true });
    },
  });
}

function registerTimeRangeListener(): void {
  startAppListening({
    actionCreator: filterByTimeRange,
    effect: async (action, api) => {
      api.cancelActiveListeners();
      const state = api.getState();
      const keyword = state.selectedKeyword.selectedKeyword;
      const selectedGeoData = state.dataset.selectedGeoData;

      try {
        const timeResult = await api
          .dispatch(
            dataApi.endpoints.getTimeDatasetData.initiate({
              start: action.payload.start_date,
              end: action.payload.end_date,
            })
          )
          .unwrap();

        let ids = getDatasetID(timeResult.result);

        if (keyword) {
          ids = getDatasetIDIntersection(ids, keyword.dataset_id);
        }
        if (selectedGeoData.length) {
          ids = getDatasetIDIntersection(ids, selectedGeoData);
        }

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
