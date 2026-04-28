import createIntervalTree from "interval-tree-1d";
import _ from "lodash";
import {
  AuthorData,
  ChordData,
  IDataset,
  IDatasetID,
  IGeoData,
  ITimeData,
  ITransformedTimeData,
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

/** Utility function for deselecting geoData  */
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

/** Utility function to update selectedGeoData points to exclude search term related data  */
export const filterDatasetsIfChanged = (
  locationData: IGeoData[],
  selectedGeoDataset: IDatasetID[]
): IDatasetID[] | null => {
  const locationDataIds = new Set(locationData.map((data) => data.id));

  const filteredSelectedGeoDataset = selectedGeoDataset.filter((id) =>
    locationDataIds.has(id)
  );

  if (
    filteredSelectedGeoDataset.length === selectedGeoDataset.length &&
    filteredSelectedGeoDataset.every(
      (id, index) => id === selectedGeoDataset[index]
    )
  ) {
    return null;
  }

  return filteredSelectedGeoDataset;
};

/** utility function to get intersection of two datasetID arrays */
export const getDatasetIDIntersection = (
  firsDatasetIDs: IDatasetID[],
  secondDatasetIDs: IDatasetID[]
): IDatasetID[] => {
  return _.intersection(firsDatasetIDs, secondDatasetIDs);
};

/** utility function to extract date data to create and set the timeData slice */
export const extractAndTransformTimeData = (
  data: IDataset[]
): ITransformedTimeData[] => {
  return (
    _.chain(data)
      .filter((item) => {
        if (!_.isNull(item.temporal_coverage)) {
          return (
            item.temporal_coverage?.start_date !== null &&
            item.temporal_coverage?.end_date !== null
          );
        }
        return true;
      })
      .map((item) => {
        let start = item.temporal_coverage?.start_date as any;
        let end = item.temporal_coverage?.end_date as any;

        // Check if start and end are the same day
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (
          startDate.getFullYear() === endDate.getFullYear() &&
          startDate.getMonth() === endDate.getMonth() &&
          startDate.getDate() === endDate.getDate()
        ) {
          // Add an additional day to the end date
          endDate.setDate(endDate.getDate() + 1);
          end = endDate.toISOString();
        }

        return {
          start,
          end,
          dataset_title: item.dataset_title,
        };
      })
      // .orderBy(['start'], ['asc']) // Use 'start' directly for sorting as they are valid date strings
      .value()
  );
};

/** utility function to create interval timedata from startDate, endDate and timeData */
export const intervalTreeFromTimedata = (
  startDate: Date,
  endDate: Date,
  timeData: ITransformedTimeData[]
): ITimeData[] => {
  const numericIntervals = timeData.map((interval) => {
    return [
      new Date(interval.start).getTime(),
      new Date(interval.end).getTime(),
    ];
  });

  //@ts-ignore
  const tree = createIntervalTree(numericIntervals);
  const intersectionCounts = [];
  for (
    let currentDay = new Date(startDate);
    currentDay <= endDate;
    currentDay.setDate(currentDay.getDate() + 1)
  ) {
    let queryResult = 0;
    //@ts-ignore
    tree.queryPoint(currentDay.getTime(), () => {
      queryResult++;
    });
    intersectionCounts.push(queryResult);
  }
  const result = [];
  for (let i = 0; i < intersectionCounts.length; i++) {
    let currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    // let dateString = currentDate.toISOString().split("T")[0]; // Format date as "YYYY-MM-DD"
    let dateString = currentDate.getTime();
    result.push({
      date: dateString,
      value: intersectionCounts[i],
    });
  }

  return result;
};

/**Utility function to get the IDatasetID from IDataset */
export const getDatasetID = (dataset: IDataset[]): IDatasetID[] => {
  return dataset.map((item) => item.id);
};

/**Utility function to process author data for node link diagram */
export const processAuthorData = (data: AuthorData[]): ChordData[] => {
  // Step 1: build dataset→authors index in O(nm)
  const datasetToAuthors = new Map<string, string[]>();
  for (const { author, datasets } of data) {
    for (const dataset of datasets) {
      let authors = datasetToAuthors.get(dataset as string);
      if (!authors) {
        authors = [];
        datasetToAuthors.set(dataset as string, authors);
      }
      authors.push(author);
    }
  }

  // Step 2: for each dataset generate all author pairs and count shared datasets
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

/** Utility function to convert Date from javascript Date string to 'dd-mm-yyyy' */
export const convertToDateString = (date: Date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are zero-based
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

/** Utility function to calculate first and second row height for the chart display. Minimum height first row and second row can have is 500px and 400px respectively  */
export const calculateRowHeights = (
  viewportHeight: number,
  navbarHeight: number
): { firstRowHeight: string; secondRowHeight: string } => {
  const minHeightFirstRow = 500;
  const minHeightSecondRow = 400;

  // Calculate the remaining height after subtracting the navbar and additional 100px
  const remainingHeight = viewportHeight - navbarHeight - 100;

  // Calculate the ideal heights based on the 5:4 ratio
  let firstRowHeight = (remainingHeight * 5) / 9;
  let secondRowHeight = (remainingHeight * 4) / 9;

  // Ensure that the heights meet the minimum requirements
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
