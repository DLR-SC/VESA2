import { Request, Response, Router } from "express";
import { harvestPangaea } from "../services/pangaea/harvester";
import { db } from "../database";
import dotenv from "dotenv";

dotenv.config();
const router = Router();

router.post("/run", async (_req: Request, res: Response) => {
  try {
    const rawLimit = _req.body?.limit;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 100;
    const targetDb = db.database(process.env.ARANGO_DB_NAME || "vesa2db");

    harvestPangaea(targetDb, limit).catch((err) =>
      console.error("BG Harvest Error:", err),
    );

    res.status(202).json({
      message: "Harvesting started in the background.",
      target_limit: limit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
