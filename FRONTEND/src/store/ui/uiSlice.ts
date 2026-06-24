import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Layout } from "react-grid-layout";
import { chartsDefaultLayout } from "../../data/chartsDefaultLayout";

interface UIState {
  realignMode: boolean;
  gridLayout: Layout[];
  disconnectedSources: string[]; // source prefixes hidden from the visualization
}

const DISCONNECTED_KEY = "disconnectedSources";

const loadDisconnected = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISCONNECTED_KEY) ?? "[]");
  } catch {
    return [];
  }
};

const initialState: UIState = {
  realignMode: false,
  gridLayout: chartsDefaultLayout,
  disconnectedSources: loadDisconnected(),
};

const UISlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setRealignMode(state, action: PayloadAction<boolean>) {
      state.realignMode = action.payload;
    },
    updateGridLayout(state, action: PayloadAction<Layout[]>) {
      state.gridLayout = action.payload;
    },
    resetLayout(state) {
      state.gridLayout = chartsDefaultLayout;
    },
    // Show/hide a loaded source in the visualization. Non-destructive — data stays in the DB.
    toggleSourceConnection(state, action: PayloadAction<string>) {
      const prefix = action.payload;
      state.disconnectedSources = state.disconnectedSources.includes(prefix)
        ? state.disconnectedSources.filter((p) => p !== prefix)
        : [...state.disconnectedSources, prefix];
      // ponytail: localStorage write in reducer; swap for a store.subscribe persister if SSR is ever needed
      localStorage.setItem(DISCONNECTED_KEY, JSON.stringify(state.disconnectedSources));
    },
  },
});

export const { setRealignMode, updateGridLayout, resetLayout, toggleSourceConnection } =
  UISlice.actions;
export default UISlice.reducer;
