import { Request, Response, Router } from "express";
import { pingDatabase } from "../services/pingService";

const router: Router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const dbStatus = await pingDatabase();
    if (dbStatus) {
      res.status(200).send("OK, Node service and database are healthy");
      return;
    }
    res.status(500).send("Database connection failed");
  } catch {
    res.status(500).send("Database connection failed");
  }
});

export default router;
