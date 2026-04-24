import { Request, Response, Router } from "express";
import {
  getServices,
  type AdapterDatasetID,
} from "../gateway";
import {
  fetchPersistedDatasetIds,
  filterCommonDatasetIds,
} from "../helper/getPersistedDatasetId";
import { IDatasetID } from "../types/types";

const router: Router = Router();

const normalizeIds = (value: IDatasetID | IDatasetID[]): AdapterDatasetID[] =>
  (Array.isArray(value) ? value : [value]) as AdapterDatasetID[];

router.post("/persist", async (req: Request, res: Response) => {
  try {
    const input = normalizeIds(req.body.key) as unknown as IDatasetID[];
    const persistedDatasetId = await fetchPersistedDatasetIds();
    const commonDatasetIds = filterCommonDatasetIds([input], persistedDatasetId);

    const { datasetService } = getServices();
    const datasets = await datasetService.getByIds(commonDatasetIds.flat() as AdapterDatasetID[]);
    res.status(200).json({ result: datasets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const datasetIds = normalizeIds(req.body.key);
    const { datasetService } = getServices();
    const datasets = await datasetService.getByIds(datasetIds);
    res.status(200).json({ result: datasets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.get("/all", async (_req: Request, res: Response) => {
  try {
    const { datasetService } = getServices();
    const datasets = await datasetService.getAll();
    res.status(200).json({ result: datasets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;

/* 
    In this route you can send the Dataset_id by post request
    and get the dataset object as a response.
*/

/**
 *  POST request to /main with the Dataset_id returns the dataset objects of only the dataset_id which is posted.
 *
 *  POST request to /main/persist with the Dataset_id returns the dataset objects of the dataset_id which is posted
 *  and also checks if the dataset_id is persisted or not amd returns only the persisted datasets.
 *
 * GET request to /main/all returns all the dataset objects of all the dataset_id  which is used
 * in the initial page load and when the user clicks on the reset button.
 *
 */
