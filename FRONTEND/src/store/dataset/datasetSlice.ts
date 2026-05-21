import { createAction, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  ChordData,
  IDataset,
  IDatasetID,
  IGeoData,
  IKeywordData,
  ITimeData,
  TemporalCoverage,
} from "types/appData";
import { extractGeoData, toggleSelectedGeoData } from "./utility/utility";

// Resolved dataset IDs for each active filter dimension.
// Geo is excluded here — it is always read directly from selectedGeoData.
export interface ActiveFilters {
  keyword: IDatasetID[] | null;
  time: IDatasetID[] | null;
}

export interface IDatasetSlice {
  dataset: IDataset[];
  keywordData: IKeywordData[];
  geoData: IGeoData[];
  selectedGeoData: IDatasetID[];
  timeData: ITimeData[];
  chordData: ChordData[];
  isFiltering: boolean;
  activeFilters: ActiveFilters;
}

const initialState: IDatasetSlice = {
  dataset: [],
  keywordData: [],
  geoData: [],
  selectedGeoData: [],
  timeData: [],
  chordData: [],
  isFiltering: false,
  activeFilters: { keyword: null, time: null },
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
      // Atomically deselect any geo IDs that no longer exist in the refreshed dataset
      if (state.selectedGeoData.length) {
        const validIds = new Set(newGeoData.map((d) => d.id));
        state.selectedGeoData = state.selectedGeoData.filter((id) => validIds.has(id));
      }
    },
    setKeywordData(state, action: PayloadAction<IKeywordData[]>) {
      state.keywordData = action.payload;
    },
    setGeoData(state, action: PayloadAction<IDataset[]>) {
      state.geoData = extractGeoData(action.payload);
    },
    updateSelectedGeoData(state, action: PayloadAction<IDatasetID>) {
      state.selectedGeoData = toggleSelectedGeoData(
        state.selectedGeoData,
        action.payload
      );
    },
    setSelectedGeoData(state, action: PayloadAction<IDatasetID[]>) {
      state.selectedGeoData = action.payload;
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
    setActiveKeywordFilter(state, action: PayloadAction<IDatasetID[]>) {
      state.activeFilters.keyword = action.payload;
    },
    clearActiveKeywordFilter(state) {
      state.activeFilters.keyword = null;
    },
    setActiveTimeFilter(state, action: PayloadAction<IDatasetID[]>) {
      state.activeFilters.time = action.payload;
    },
    clearActiveTimeFilter(state) {
      state.activeFilters.time = null;
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
  setGeoData,
  updateSelectedGeoData,
  reset: resetDatasetSlice,
  setSelectedGeoData,
  setTimeData,
  setChordData,
  setIsFiltering,
  setActiveKeywordFilter,
  clearActiveKeywordFilter,
  setActiveTimeFilter,
  clearActiveTimeFilter,
} = DatasetSlice.actions;

export const filterByTimeRange = createAction<TemporalCoverage>("dataset/filterByTimeRange");

export default DatasetSlice.reducer;
