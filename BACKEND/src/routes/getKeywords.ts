import express, { Request, Response, Router } from "express";
import {
  getServices,
  type AdapterDatasetID,
} from "../gateway";
import { IDatasetID } from "../types/types";

const router: Router = express.Router(); // Initialize the router

const normalizeIds = (value: IDatasetID | IDatasetID[]): AdapterDatasetID[] =>
  (Array.isArray(value) ? value : [value]) as AdapterDatasetID[];

router.post("/", async (req: Request, res: Response) => {
  try {
    const { keywordService } = getServices();
    const datasetIds = normalizeIds(req.body.key);
    const keywords = await keywordService.getKeywordsForDatasets(datasetIds);

    // Map inline to support frontend's legacy `dataset_id` pluralization mismatch
    const result = keywords.map(k => ({
      keyword: k.keyword,
      count: k.count,
      dataset_id: k.dataset_ids
    }));

    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.get("/all", async (_req: Request, res: Response) => {
  try {
    const { keywordService } = getServices();
    const keywords = await keywordService.getAllKeywords();

    // Map inline to support frontend's legacy `dataset_id` pluralization mismatch
    const result = keywords.map(k => ({
      keyword: k.keyword,
      count: k.count,
      dataset_id: k.dataset_ids
    }));

    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;

/**
 * This file is a route that is used to get the keywords of a dataset by its id.
 * The route is accessed by a POST request to /keywords.
 */

/**
 * This is used for the Wordcloud component.
 * When a single keyword is clicked, the ^dataset_id array of that
 * keyword is sent to the backend and all the datasets/keywords with that
 * dataset_ids are returned.
 */
