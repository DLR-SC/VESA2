import { Request, Response, Router } from "express";
import { mapFullQuery, mapNullQuery } from "../queries/mapQuery";
import { db } from "../database";
import { Database } from "arangojs";
import { IDatasetID } from "../types/types";
import { ArrayCursor } from "arangojs/cursor";

const router: Router = Router();
const database: Database = db;

const runMapQuery = async (query: string): Promise<IDatasetID[]> => {
  const cursor: ArrayCursor<IDatasetID> = await database.query(query);
  return cursor.all();
};

router.get("/full", async (_req: Request, res: Response) => {
  try {
    const result = await runMapQuery(mapFullQuery);
    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

router.get("/null", async (_req: Request, res: Response) => {
  try {
    const result = await runMapQuery(mapNullQuery);
    res.status(200).json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ message });
  }
});

export default router;
