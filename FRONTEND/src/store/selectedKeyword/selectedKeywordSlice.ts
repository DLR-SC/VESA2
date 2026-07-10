import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IKeywordData } from "types/appData";

export interface ISelectedKeyword {
  selectedKeyword: IKeywordData | null;
}

const initialState: ISelectedKeyword = {
  selectedKeyword: null,
};

// The information regarding selected keyword will be stored in this slice
const SelectedKeywordSlice = createSlice({
  name: "SelectedKeyword",
  initialState,
  reducers: {
    // Dispatching this triggers the keyword listener (full filter flow).
    update(state, action: PayloadAction<IKeywordData | null>) {
      state.selectedKeyword = action.payload;
    },
    // Silent state update — does NOT trigger the keyword listener.
    // Used by the undo listener to restore the previous keyword without re-filtering.
    set(state, action: PayloadAction<IKeywordData | null>) {
      state.selectedKeyword = action.payload;
    },
    reset() {
      return initialState;
    },
  },
});

export const {
  update: updateSelectedKeyword,
  set: setSelectedKeyword,
  reset: resetSelectedKeyword,
} = SelectedKeywordSlice.actions;

export default SelectedKeywordSlice.reducer;
