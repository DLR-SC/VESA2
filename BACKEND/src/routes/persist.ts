import { Request, Response, Router } from "express";
import { IDatasetID } from "../types/types";

const router: Router = Router();

let keys: IDatasetID[] = [];

router.post("/", (req: Request, res: Response) => {
  try {
    keys = [req.body.key];
    res.status(200).json({ keys });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.get("/", (req: Request, res: Response) => {
  try {
    res.status(200).json({ keys });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;

/**
 * This file is used to store the previous state or persist the
 * previous state of the dataset_id so that when a new filter is applied
 * the new data will be related to the previous state of the dataset_id.
 */

/**
 * The route will be cleared after every POST request.
 */
