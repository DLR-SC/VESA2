import { useEffect } from "react";
import {
  resetDatasetSlice,
  setChordData,
  setDataset,
  setDatasetWithGeo,
  setKeywordData,
  setTimeData,
} from "../store/dataset/datasetSlice";
import {
  extractAndTransformTimeData,
  getDatasetID,
  getDatasetIDIntersection,
  intervalTreeFromTimedata,
  processAuthorData,
} from "../store/dataset/utility/utility";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  useGetInitialAuthorDataQuery,
  useGetInitialDatasetsQuery,
  useGetInitialKeywordDataQuery,
} from "../store/services/dataApi";
import {
  IDataset,
  IDatasetID,
  IKeywordData,
  ITransformedTimeData,
  TemporalCoverage,
} from "types/appData";
import { useQuery } from "./useQuery";

/** A custom query for filling data states */
export const useDatafill = () => {
  const dispatch = useAppDispatch();

  const { data: initialDataset } = useGetInitialDatasetsQuery();
  const { data: initialkeywordData } = useGetInitialKeywordDataQuery();
  const { data: initialAuthorData } = useGetInitialAuthorDataQuery();

  const {
    getRelatedKeywords,
    getRelatedDatasets,
    getAuthorData,
    getTimeDataset,
  } = useQuery();

  const selectedKeywordObject = useAppSelector(
    (state) => state.selectedKeyword.selectedKeyword as IKeywordData
  );
  const selectedGeoData = useAppSelector(
    (state) => state.dataset.selectedGeoData
  );

  /** Fallback view-range for the column chart before data loads */
  const initialDateRanges = {
    startDate: new Date("1950-01-01"),
    endDate: new Date("2030-01-01"),
  };

  useEffect(() => {
    if (initialDataset?.result) {
      dispatch(setDatasetWithGeo(initialDataset.result));
      dispatch(setTimeData(timeDataExtractor(initialDataset.result)));
    }
  }, [initialDataset]);

  useEffect(() => {
    if (initialkeywordData?.result) {
      dispatch(setKeywordData(initialkeywordData.result));
    }
  }, [initialkeywordData]);

  useEffect(() => {
    if (initialAuthorData?.result) {
      dispatch(setChordData(processAuthorData(initialAuthorData.result)));
    }
  }, [initialAuthorData]);

  /**
   * Core fetch orchestrator. Keywords and datasets are fetched in parallel;
   * author data is fetched afterwards only when needed.
   */
  const fetchAndSet = async (
    datasetIds: IDatasetID[],
    skipGeoData = false,
    skipAuthorData = false,
    skipTimeData = false
  ) => {
    const [keywordsData, datasetsData] = await Promise.all([
      getRelatedKeywords(datasetIds),
      getRelatedDatasets(datasetIds),
    ]);

    dispatch(setKeywordData(keywordsData.result));

    if (skipGeoData) {
      dispatch(setDataset(datasetsData.result));
    } else {
      dispatch(setDatasetWithGeo(datasetsData.result));
    }

    if (!skipTimeData) {
      dispatch(setTimeData(timeDataExtractor(datasetsData.result)));
    }

    if (!skipAuthorData) {
      const authorData = await getAuthorData(datasetIds);
      dispatch(setChordData(processAuthorData(authorData.result)));
    }
  };

  const fetchAndSetRelatedDataAgainstKeyword = async () => {
    if (selectedKeywordObject) {
      fetchAndSet(selectedKeywordObject.dataset_id);
    } else {
      dispatch(resetDatasetSlice());
      initialSetterBundle();
    }
  };

  const fetchAndSetAgainstTimeData = async (range: TemporalCoverage) => {
    const result = await getTimeDataset(range);
    let datasetIDs = getDatasetID(result.result);

    if (selectedKeywordObject) {
      datasetIDs = getDatasetIDIntersection(
        datasetIDs,
        selectedKeywordObject.dataset_id
      );
    }

    if (selectedGeoData.length) {
      datasetIDs = getDatasetIDIntersection(datasetIDs, selectedGeoData);
    }

    fetchAndSet(datasetIDs, false, false, true);
  };

  const compareAndResetAgainstGeoData = (datasetIds: IDatasetID[]) => {
    if (datasetIds.length) {
      fetchAndSet(datasetIds, true);
    } else {
      if (selectedKeywordObject) {
        fetchAndSet(selectedKeywordObject.dataset_id, true);
      } else {
        initialSetterBundle();
      }
    }
  };

  /** Derives date range from actual data instead of using a hardcoded 80-year span. */
  const timeDataExtractor = (dataset: IDataset[]) => {
    const timeData = extractAndTransformTimeData(dataset);
    if (!timeData.length) return [];

    const { startDate, endDate } = deriveDateRange(timeData);
    return intervalTreeFromTimedata(startDate, endDate, timeData);
  };

  const initialSetterBundle = () => {
    if (initialDataset?.result) {
      dispatch(setDatasetWithGeo(initialDataset.result));
      dispatch(setTimeData(timeDataExtractor(initialDataset.result)));
    }
    if (initialkeywordData?.result) {
      dispatch(setKeywordData(initialkeywordData.result));
    }
    if (initialAuthorData?.result) {
      dispatch(setChordData(processAuthorData(initialAuthorData.result)));
    }
  };

  return {
    initialDateRanges,
    fetchAndSetRelatedDataAgainstKeyword,
    fetchAndSetAgainstTimeData,
    compareAndResetAgainstGeoData,
    fetchAndSet,
    initialSetterBundle,
  };
};

/** Computes start/end from actual dataset dates with a 1-year buffer on each side. */
function deriveDateRange(timeData: ITransformedTimeData[]): {
  startDate: Date;
  endDate: Date;
} {
  const bufferMs = 365 * 24 * 60 * 60 * 1000;
  let min = Infinity;
  let max = -Infinity;

  for (const { start, end } of timeData) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!isNaN(s) && s < min) min = s;
    if (!isNaN(e) && e > max) max = e;
  }

  if (!isFinite(min) || !isFinite(max)) {
    return { startDate: new Date("1950-01-01"), endDate: new Date("2030-01-01") };
  }

  return { startDate: new Date(min - bufferMs), endDate: new Date(max + bufferMs) };
}
