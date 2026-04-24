import { Request, Response, Router } from "express";
import { Database } from "arangojs";
import { ArrayCursor } from "arangojs/cursor";

import { db } from "../database";
import { timechartQuery } from "../queries/timechartQuery";
import { mainQuery } from "../queries/mainQuery";
import { keywordQuery } from "../queries/keywordQuery";
import {
  fetchPersistedDatasetIds,
  filterCommonDatasetIds,
} from "../helper/getPersistedDatasetId";
import { IDataset, IDatasetID } from "../types/types";

const router: Router = Router();
const database: Database = db;

const normalizeDate = (value: unknown) =>
  typeof value === "string" ? new Date(value).toISOString() : value;

/**
 *
 * @param start Date
 * @param end Date
 * @returns Promise<IDatasetID[]>
 *
 * This function fetched the dataset_id by using the start and end time/date
 */
const getDatasetIdByTime = async (
  start: unknown,
  end: unknown
): Promise<IDatasetID[]> => {
  const cursor: ArrayCursor<IDatasetID> = await database.query(timechartQuery, {
    start,
    end,
  });
  const result = await cursor.all();
  return result.flat().map((item: unknown) => item as IDatasetID);
};

const queryDatasets = async (query: string, keys: IDatasetID[]) => {
  const cursor: ArrayCursor<IDataset> = await database.query(query, { keys });
  return cursor.all();
};

router.post("/main", async (req: Request, res: Response) => {
  try {
    const start = normalizeDate(req.body.start);
    const end = normalizeDate(req.body.end);
    const keys = await getDatasetIdByTime(start, end);
    const result = await queryDatasets(mainQuery, keys);
    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.post("/keyword", async (req: Request, res: Response) => {
  try {
    const start = normalizeDate(req.body.start);
    const end = normalizeDate(req.body.end);
    const keys = await getDatasetIdByTime(start, end);
    const result = await queryDatasets(keywordQuery, keys);
    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.post("/main/persist", async (req: Request, res: Response) => {
  try {
    const start = normalizeDate(req.body.start);
    const end = normalizeDate(req.body.end);
    const keys = await getDatasetIdByTime(start, end);
    const persistedDatasetId = await fetchPersistedDatasetIds();
    const commonDatasetIds = filterCommonDatasetIds([keys], persistedDatasetId);
    const result = await queryDatasets(mainQuery, commonDatasetIds.flat());
    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.post("/keyword/persist", async (req: Request, res: Response) => {
  try {
    const start = normalizeDate(req.body.start);
    const end = normalizeDate(req.body.end);
    const keys = await getDatasetIdByTime(start, end);
    const persistedDatasetId = await fetchPersistedDatasetIds();
    const commonDatasetIds = filterCommonDatasetIds([keys], persistedDatasetId);
    const result = await queryDatasets(keywordQuery, commonDatasetIds.flat());
    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;

/*
    This route is used to get the dataset_id by
    using the start and end time/date from the
    TIME SERIES CHART from the frontend.
*/

/**
 *  POST request to /time with the start and end date fetches all Datasets which
 *  are within the given time range.
 *
 *  POST request to /time/persist with the start and end date fetches all Datasets
 *  which are within the given time range and are persisted from previously applied filters.
 */
