import { Router, Request, Response } from "express";
import { CollectionType } from "arangojs/collection";
import { db } from "../database";
import dotenv from "dotenv";


const router = Router();
dotenv.config();

router.post("/", async (_req: Request, res: Response) => {
  const dbName = process.env.ARANGO_DB_NAME || "vesa2db";
  const docCollections = ["Dataset", "Author", "Keywords"];
  const edgeCollections = ["HasAuthor", "HasKeyword"];

  try {
    const systemDb = db.database("_system");
    const databases = await systemDb.listDatabases();
    let databaseRecreated = false;

    if (databases.includes(dbName)) {
      await systemDb.dropDatabase(dbName);
      databaseRecreated = true;
    }

    await systemDb.createDatabase(dbName);

    const targetDb = db.database(dbName);
    const created = { documents: [] as string[], edges: [] as string[] };

    for (const name of docCollections) {
      const col = targetDb.collection(name);
      if (!(await col.exists())) {
        await col.create();
        created.documents.push(name);
      }
    }

    for (const name of edgeCollections) {
      const col = targetDb.collection(name);
      if (!(await col.exists())) {
        await col.create({ type: CollectionType.EDGE_COLLECTION });
        created.edges.push(name);
      }
    }

    res.status(200).json({
      status: "success",
      database: dbName,
      databaseRecreated,
      created,
      message: databaseRecreated
        ? "Database deleted and recreated from scratch"
        : "Database created and collections initialized",
    });
  } catch (error) {
    console.error("initemptydb failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ status: "error", message });
  }
});

export default router;
