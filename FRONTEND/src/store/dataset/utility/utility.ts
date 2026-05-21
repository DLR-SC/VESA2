import _ from "lodash";
import {
  AuthorData,
  ChordData,
  IDataset,
  IDatasetID,
  IGeoData,
  ITimeData,
} from "types/appData";

export const extractGeoData = (datasets: IDataset[]): IGeoData[] => {
  const hasValidLocation = (
    dataset: IDataset
  ): dataset is IDataset & {
    location_data: { mean_latitude: `${number}`; mean_longitude: `${number}` };
  } => {
    return (
      dataset.location_data !== undefined &&
      dataset.location_data.mean_latitude !== null &&
      dataset.location_data.mean_longitude !== null
    );
  };

  return datasets.filter(hasValidLocation).map((dataset) => ({
    id: dataset.id,
    coordinates: [
      dataset.location_data.mean_longitude,
      dataset.location_data.mean_latitude,
    ],
    groupId: dataset.dataset_source_prefix,
  }));
};

export const toggleSelectedGeoData = (
  selectedGeoData: IDatasetID[],
  datasetID: IDatasetID
): IDatasetID[] => {
  const exists = selectedGeoData.includes(datasetID);
  if (exists) {
    return selectedGeoData.filter((id) => id !== datasetID);
  } else {
    return [...selectedGeoData, datasetID];
  }
};

export const getDatasetIDIntersection = (
  firsDatasetIDs: IDatasetID[],
  secondDatasetIDs: IDatasetID[]
): IDatasetID[] => {
  return _.intersection(firsDatasetIDs, secondDatasetIDs);
};

export const getDatasetID = (dataset: IDataset[]): IDatasetID[] => {
  return dataset.map((item) => item.id);
};

const DAY_MS = 86_400_000;

export function computeTimeDataAsync(dataset: IDataset[]): Promise<ITimeData[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../../../workers/timeDataWorker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (e: MessageEvent<ITimeData[]>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
    worker.postMessage(dataset);
  });
}

export function computeTimeData(dataset: IDataset[]): ITimeData[] {
  const dayCounts = new Map<number, number>();
  for (const item of dataset) {
    if (!item.temporal_coverage) continue;
    const { start_date, end_date } = item.temporal_coverage;
    if (!start_date || !end_date) continue;
    const sKey = Math.floor(new Date(start_date).getTime() / DAY_MS);
    const eKey = Math.floor(new Date(end_date).getTime() / DAY_MS);
    if (isNaN(sKey) || isNaN(eKey) || eKey < sKey) continue;
    for (let k = sKey; k <= eKey; k++) {
      dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
    }
  }
  return [...dayCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, value]) => ({ date: key * DAY_MS, value }));
}

export const processAuthorData = (data: AuthorData[]): ChordData[] => {
  // Limit to the top-N most prolific authors before the O(n²) pairing step.
  // The chord slice is already capped at 100 entries; generating all possible pairs
  // from the full author set is wasted work.
  const TOP_AUTHORS = 60;
  const topAuthorSet = new Set(
    [...data]
      .sort((a, b) => b.datasets.length - a.datasets.length)
      .slice(0, TOP_AUTHORS)
      .map((a) => a.author)
  );

  // Step 1: build dataset→authors index (top authors only)
  const datasetToAuthors = new Map<string, string[]>();
  for (const { author, datasets } of data) {
    if (!topAuthorSet.has(author)) continue;
    for (const dataset of datasets) {
      let authors = datasetToAuthors.get(dataset as string);
      if (!authors) {
        authors = [];
        datasetToAuthors.set(dataset as string, authors);
      }
      authors.push(author);
    }
  }

  // Step 2: generate all co-author pairs and count shared datasets
  const pairDatasets = new Map<string, Set<string>>();
  for (const [dataset, authors] of datasetToAuthors) {
    for (let i = 0; i < authors.length; i++) {
      for (let j = i + 1; j < authors.length; j++) {
        const a = authors[i];
        const b = authors[j];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        let shared = pairDatasets.get(key);
        if (!shared) {
          shared = new Set<string>();
          pairDatasets.set(key, shared);
        }
        shared.add(dataset);
      }
    }
  }

  const formattedData: ChordData[] = [];
  for (const [key, shared] of pairDatasets) {
    const dashIdx = key.indexOf("-");
    formattedData.push({
      from: key.slice(0, dashIdx),
      to: key.slice(dashIdx + 1),
      value: shared.size,
    });
  }

  return formattedData;
};

export const convertToDateString = (date: Date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const calculateRowHeights = (
  viewportHeight: number,
  navbarHeight: number
): { firstRowHeight: string; secondRowHeight: string } => {
  const minHeightFirstRow = 500;
  const minHeightSecondRow = 400;

  const remainingHeight = viewportHeight - navbarHeight - 100;

  let firstRowHeight = (remainingHeight * 5) / 9;
  let secondRowHeight = (remainingHeight * 4) / 9;

  if (firstRowHeight < minHeightFirstRow) {
    firstRowHeight = minHeightFirstRow;
    secondRowHeight = remainingHeight - minHeightFirstRow + minHeightSecondRow;
  } else if (secondRowHeight < minHeightSecondRow) {
    secondRowHeight = minHeightSecondRow;
    firstRowHeight = remainingHeight - minHeightSecondRow + minHeightFirstRow;
  }

  return {
    firstRowHeight: `${firstRowHeight}px`,
    secondRowHeight: `${secondRowHeight}px`,
  };
};
