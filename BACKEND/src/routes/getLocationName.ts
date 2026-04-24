import { Request, Response, Router } from "express";
import { getLocationNameFromAPI } from "../services/Maps/getLocationName";

const router: Router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.body;
    const locationName = await getLocationNameFromAPI(lat, lon);
    res.status(200).json({ locationName });
  } catch (error: unknown) {
    const e = error as {
      response?: {
        data?: {
          error?: { code?: number; message?: string };
        };
      };
    };
    const code = e.response?.data?.error?.code;
    const message = e.response?.data?.error?.message;

    if (code && message) {
      res.status(500).json({ message: `Error Code: ${code}, Message: ${message}` });
      return;
    }

    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

/**
 * Since the API we are using is a free API, it has a limit on
 * the number of requests that can be made in a second. (1req/sec)
 *
 * To avoid the rate limit, we are using a delay of 1 second between
 * each request in the test cases.
 *
 * Error Code 429: Too many requests
 *
 */
