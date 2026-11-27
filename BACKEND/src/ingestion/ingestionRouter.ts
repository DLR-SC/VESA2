import express, { Request, Response } from 'express';
import { SyncOrchestrator, SyncBusyError } from './SyncOrchestrator';
import { db } from '../database';
import { syncHistoryQuery } from '../queries/syncHistoryQuery';

// One orchestrator for the process, so its state survives across requests.
const orchestrator = new SyncOrchestrator(db);

// The UI sends this server's own proxies as relative paths ("/oai/records?...", "/proxy/pangaea/records"),
// because the browser can't know the backend's address inside Docker. Resolve those against this process;
// absolute URLs pass through unchanged. Port fallback matches index.ts.
const SELF_BASE = `http://127.0.0.1:${Number(process.env.NODE_PORT) || 3000}`;
const resolveTarget = (url: string) => new URL(url, SELF_BASE).toString();

export const getIngestionRouter = () => {
  const router = express.Router();

  // POST /sync/start — the job's first page doubles as the handshake (see SyncOrchestrator.harvest).
  router.post('/start', async (req: Request, res: Response): Promise<void> => {
    try {
      const { target_url, dataset_id, batch_size, total_limit, overwrite, inter_batch_sleep_ms, ui_config } = req.body;
      if (!target_url || !dataset_id) {
        res.status(400).json({ error: 'target_url and dataset_id are required' });
        return;
      }

      // Start the sync process and await the Job ID
      const jobId = await orchestrator.sync(resolveTarget(target_url), dataset_id, total_limit || 1000, batch_size || 100, overwrite, inter_batch_sleep_ms ?? 1000, ui_config ?? {});

      res.status(202).json({
        message: 'Sync started.',
        target_url,
        dataset_id,
        job_id: jobId
      });
    } catch (error: any) {
      if (error instanceof SyncBusyError) {
        res.status(409).json({ error: error.message });
        return;
      }
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

  // 5. POST /sync/resume
  router.post('/resume', async (req: Request, res: Response): Promise<void> => {
    try {
      const { job_id } = req.body;
      if (!job_id) {
        res.status(400).json({ error: 'job_id is required' });
        return;
      }
      const resumedJobId = await orchestrator.resume(job_id);
      res.status(202).json({ message: 'Resume started.', job_id: resumedJobId });
    } catch (error: any) {
      if (error instanceof SyncBusyError) {
        res.status(409).json({ error: error.message });
        return;
      }
      console.error('[Ingestion API] Resume error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 6b. DELETE /sync/source/:prefix — permanently removes a source's data. Idempotent.
  router.delete('/source/:prefix', async (req: Request, res: Response): Promise<void> => {
    try {
      const { prefix } = req.params;
      const status = orchestrator.getStatus();
      if (status.status === 'running' && status.current_prefix === prefix) {
        res.status(409).json({ error: `Cannot delete '${prefix}' while it is importing. Stop the import first.` });
        return;
      }
      await orchestrator.purgeSource(prefix);
      // Drop stale in-memory state so /sync/status won't report this deleted job once SyncLogs is empty.
      if (orchestrator.getStatus().current_prefix === prefix) orchestrator.resetState();
      res.status(204).end();
    } catch (error: any) {
      console.error("[Ingestion API] Delete source error:", error);
      res.status(500).json({ error: "Failed to delete the data source." });
    }
  });

  // 6. GET /sync/history
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
