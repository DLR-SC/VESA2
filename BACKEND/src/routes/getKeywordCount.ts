import express, { Request, Response, Router } from "express";
import axios from "axios";
import processResult from "../services/Wordcloud/lenghtFiltering";
import { IKeyword } from "../types/types";

const router: Router = express.Router(); // Initialize the router

router.get("/", async (_req: Request, res: Response) => {
  try {
    const response = await axios.get("http://localhost:3001/keywords");
    const result: IKeyword[][] = response.data.result; // Get the result from the response

    // Extract only the keywords from the result
    const keywords: IKeyword[] = processResult(result);

    res.status(200).json({ result: keywords });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    res.status(500).json({ error: message });
  }
});

router.get("/all", async (_req: Request, res: Response) => {
  try {
    const response = await axios.get("http://localhost:3001/keywords/all");
    const result: IKeyword[][] = response.data.result;

    // Extract only the keywords from the result
    const keywords: IKeyword[] = processResult(result);

    res.status(200).json({ result: keywords });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    res.status(500).json({ error: message });
  }
});

export default router;
