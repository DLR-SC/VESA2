import { createContext, useContext } from "react";
import { IDatasetID, TemporalCoverage } from "types/appData";

export interface DatafillContextValue {
  compareAndResetAgainstGeoData: (ids: IDatasetID[]) => void;
  fetchAndSetAgainstTimeData: (range: TemporalCoverage) => Promise<void>;
  fetchAndSetRelatedDataAgainstKeyword: () => Promise<void>;
  initialSetterBundle: () => void;
  initialDateRanges: { startDate: Date; endDate: Date };
}

export const DatafillContext = createContext<DatafillContextValue | null>(null);

export const useDatafillContext = (): DatafillContextValue => {
  const ctx = useContext(DatafillContext);
  if (!ctx) throw new Error("useDatafillContext must be used inside a DatafillContext.Provider");
  return ctx;
};
