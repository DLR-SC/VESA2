import express, { Request, Response } from 'express';
import { HandshakeValidator } from './validation/HandshakeValidator';
import { SyncOrchestrator } from './SyncOrchestrator';
import { db } from '../database';
import { syncHistoryQuery } from '../queries/syncHistoryQuery';

// Instantiateorchestrator outside to maintain state across requests
const orchestrator = new SyncOrchestrator(db);
const validator = new HandshakeValidator();

export const getIngestionRouter = () => {
  const router = express.Router();

  // 1. POST /sync/validate
  router.post('/validate', async (req: Request, res: Response): Promise<void> => {
    try {
      const { target_url, dataset_id, overwrite } = req.body;
      if (!target_url || !dataset_id) {
        res.status(400).json({ error: 'target_url and dataset_id are required' });
        return;
      }
      
      if (!overwrite) {
        const exists = await orchestrator.checkDatasetExists(dataset_id);
        if (exists) {
          res.status(409).json({ 
            error: `A dataset with the label '${dataset_id}' already exists.` 
          });
          return;
        }
      }

      const result = await validator.validate(target_url);
      if (!result.valid) {
        let status = 400;
        if (result.reason === 'invalid_schema') status = 422;
        else if (result.reason === 'source_offline' || result.reason === 'unreachable') status = 502;
        
        res.status(status).json(result);
        return;
      }
      res.json(result);
    } catch (error: any) {
      console.error("[Ingestion API] Validation error:", error);
      res.status(500).json({ error: "An unexpected error occurred while verifying the connection. Please try again." });
    }
  });

  // 2. POST /sync/start
  router.post('/start', async (req: Request, res: Response): Promise<void> => {
    try {
      const { target_url, dataset_id, batch_size, total_limit, overwrite, inter_batch_sleep_ms, ui_config } = req.body;
      if (!target_url || !dataset_id) {
        res.status(400).json({ error: 'target_url and dataset_id are required' });
        return;
      }

      // Start the sync process and await the Job ID
      const jobId = await orchestrator.sync(target_url, dataset_id, total_limit || 1000, batch_size || 100, overwrite, inter_batch_sleep_ms ?? 1000, ui_config ?? {});

      res.status(202).json({
        message: 'Sync started.',
        target_url,
        dataset_id,
        job_id: jobId
      });
    } catch (error: any) {
      console.error("[Ingestion API] Start error:", error);
      res.status(500).json({ error: "An unexpected error occurred while starting the import." });
    }
  });

  // 3. GET /sync/status
  router.get('/status', async (req: Request, res: Response) => {
    const currentStatus = orchestrator.getStatus();
    if (currentStatus.status === 'running') {
      res.json(currentStatus);
      return;
    }
    
    // Fallback to database if idle
    const lastJobStatus = await orchestrator.getLastJobStatus();
    res.json(lastJobStatus);
  });

  // 4. POST /sync/stop
  router.post('/stop', (req: Request, res: Response) => {
    orchestrator.stop();
    res.json({ message: 'Stop signal sent to the orchestrator.' });
  });

  // 5. GET /sync/history
  router.get('/history', async (_req: Request, res: Response): Promise<void> => {
    try {
      const cursor = await db.query(syncHistoryQuery);
      const result = await cursor.all();
      res.json({ result });
    } catch (error: any) {
      console.error("[Ingestion API] History error:", error);
      res.status(500).json({ error: "Failed to fetch sync history." });
    }
  });

  return router;
};
