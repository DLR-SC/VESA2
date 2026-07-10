import { computeTimeData } from "store/dataset/utility/utility";
import type { IDataset } from "types/appData";

self.onmessage = (e: MessageEvent<IDataset[]>) => {
  self.postMessage(computeTimeData(e.data));
};
