import { createAction, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  ChordData,
  FilterEntry,
  IDataset,
  IDatasetID,
  IGeoData,
  IKeywordData,
  ITimeData,
  TemporalCoverage,
} from "types/appData";
import { extractGeoData, toggleSelectedGeoData } from "./utility/utility";

export interface IDatasetSlice {
  dataset: IDataset[];
  keywordData: IKeywordData[];
  geoData: IGeoData[];
  filterStack: FilterEntry[];
  timeData: ITimeData[];
  chordData: ChordData[];
  isFiltering: boolean;
}

const initialState: IDatasetSlice = {
  dataset: [],
  keywordData: [],
  geoData: [],
  filterStack: [],
  timeData: [],
  chordData: [],
  isFiltering: false,
};

const DatasetSlice = createSlice({
  name: "Dataset",
  initialState,
  reducers: {
    setDataset(state, action: PayloadAction<IDataset[]>) {
      state.dataset = action.payload;
    },
    setDatasetWithGeo(state, action: PayloadAction<IDataset[]>) {
      state.dataset = action.payload;
      const newGeoData = extractGeoData(action.payload);
      state.geoData = newGeoData;
      // Prune any geo filter IDs that no longer exist in the refreshed dataset
      const geoIdx = state.filterStack.findIndex((e) => e.type === "geo");
      if (geoIdx >= 0) {
        const validIds = new Set(newGeoData.map((d) => d.id));
        const pruned = state.filterStack[geoIdx].datasetIds.filter((id) =>
          validIds.has(id)
        );
        if (pruned.length === 0) {
          state.filterStack.splice(geoIdx, 1);
        } else {
          state.filterStack[geoIdx] = {
            ...state.filterStack[geoIdx],
            datasetIds: pruned,
            label: `${pruned.length} map point${pruned.length > 1 ? "s" : ""}`,
          };
        }
      }
    },
    setKeywordData(state, action: PayloadAction<IKeywordData[]>) {
      state.keywordData = action.payload;
    },
    // Toggles a single geo point ID within the geo filterStack entry.
    // Upserts the entry on first selection; removes it when the last point is deselected.
    updateSelectedGeoData(state, action: PayloadAction<IDatasetID>) {
      const geoIdx = state.filterStack.findIndex((e) => e.type === "geo");
      if (geoIdx < 0) {
        state.filterStack.push({
          type: "geo",
          label: "1 map point",
          datasetIds: [action.payload],
        });
        return;
      }
      const toggled = toggleSelectedGeoData(
        state.filterStack[geoIdx].datasetIds,
        action.payload
      );
      if (toggled.length === 0) {
        state.filterStack.splice(geoIdx, 1);
      } else {
        state.filterStack[geoIdx] = {
          ...state.filterStack[geoIdx],
          datasetIds: toggled,
          label: `${toggled.length} map point${toggled.length > 1 ? "s" : ""}`,
        };
      }
    },
    setTimeData(state, action: PayloadAction<ITimeData[]>) {
      state.timeData = action.payload;
    },
    setChordData(state, action: PayloadAction<ChordData[]>) {
      state.chordData = action.payload.slice(0, 100);
    },
    setIsFiltering(state, action: PayloadAction<boolean>) {
      state.isFiltering = action.payload;
    },
    // Keywords are appended (sequential drill-down: A → B → C).
    // Geo and time are upserted — only one instance of each is meaningful.
    pushFilter(state, action: PayloadAction<FilterEntry>) {
      if (action.payload.type === "keyword") {
        state.filterStack.push(action.payload);
      } else {
        const idx = state.filterStack.findIndex(
          (e) => e.type === action.payload.type
        );
        if (idx >= 0) {
          state.filterStack[idx] = action.payload;
        } else {
          state.filterStack.push(action.payload);
        }
      }
    },
    // Removes ALL entries of the given type (used for full keyword clear, geo clear, time clear).
    removeFilter(state, action: PayloadAction<FilterEntry["type"]>) {
      state.filterStack = state.filterStack.filter(
        (e) => e.type !== action.payload
      );
    },
    // Removes only the last entry — used by the undo listener.
    popFilter(state) {
      state.filterStack.pop();
    },
    reset() {
      return initialState;
    },
  },
});

export const {
  setDataset,
  setDatasetWithGeo,
  setKeywordData,
  updateSelectedGeoData,
  reset: resetDatasetSlice,
  setTimeData,
  setChordData,
  setIsFiltering,
  pushFilter,
  removeFilter,
  popFilter,
} = DatasetSlice.actions;

export const filterByTimeRange = createAction<TemporalCoverage>("dataset/filterByTimeRange");
export const clearTimeFilter = createAction("dataset/clearTimeFilter");
export const undoFilter = createAction("dataset/undoFilter");

export default DatasetSlice.reducer;
