import { Router, Request, Response } from "express";
import { abstractQuery } from "../queries/abstractQuery";
import { db } from "../database";
import { Database } from "arangojs";
import { IAbstract } from "../types/types";
import { ArrayCursor } from "arangojs/cursor";
import { checkIdExists } from "../helper/checkIdExists";

const router: Router = Router();
const database: Database = db;

router.post("/", async (req: Request, res: Response) => {
  try {
    const key = req.body.key;
    const exists: boolean = await checkIdExists(key, database);

    if (!exists) {
      res.status(404).json({ message: "Dataset ID does not exist" });
      return;
    }

    const cursor: ArrayCursor<IAbstract> = await database.query(abstractQuery, { keys: key });
    const result: IAbstract[] = await cursor.all();
    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;

/**
 * This file is a route that is used to get the abstract of a dataset by its id.
 * The route is accessed by a POST request to /abstract
 */
