import { combineReducers, configureStore } from "@reduxjs/toolkit";
import DatasetReducer from "./dataset/datasetSlice";
import UIReducer from "./ui/uiSlice";
import { listenerMiddleware } from "./listenerMiddleware";
import SelectedKeywordReducer from "./selectedKeyword/selectedKeywordSlice";
import { dataApi } from "./services/dataApi";
import { miscApi } from "./services/miscApi";
import { wordCloudApi } from "./services/wordCloudApi";
import { syncApi } from "./services/syncApi";
import { registerDataListeners } from "./listeners/dataListeners";

const rootReducer = combineReducers({
  selectedKeyword: SelectedKeywordReducer,
  dataset: DatasetReducer,
  ui: UIReducer,
  [dataApi.reducerPath]: dataApi.reducer,
  [miscApi.reducerPath]: miscApi.reducer,
  [wordCloudApi.reducerPath]: wordCloudApi.reducer,
  [syncApi.reducerPath]: syncApi.reducer,
});

export const Store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(
        dataApi.middleware,
        miscApi.middleware,
        syncApi.middleware
        // logger,
      )
      .prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof Store.getState>;
export type AppDispatch = typeof Store.dispatch;

registerDataListeners();
