import { Database } from 'arangojs';
import axios from 'axios';
import { HandshakeValidator } from './validation/HandshakeValidator';
import { PrefixingService } from './services/PrefixingService';
import { RelationExtractor, GraphPayload } from './services/RelationExtractor';
import { GraphWriter } from './services/GraphWriter';
import { IDataAdapter } from './contracts/IDataAdapter';

// Global flag to disable prefixing logic entirely for testing purposes.
export const SKIP_PREFIXING_TEST_MODE = false;

type SyncStatus = 'running' | 'idle' | 'failed';

interface SyncState {
  status: SyncStatus;
  processed: number;
  total: number;
  current_prefix: string;
  job_id?: string;
  error_message?: string;
}

export class SyncOrchestrator {
  private validator = new HandshakeValidator();
  private prefixer = new PrefixingService();
  private extractor = new RelationExtractor();
  private writer: GraphWriter;
  private db: Database;

  private state: SyncState = {
    status: 'idle',
    processed: 0,
    total: 0,
    current_prefix: '',
  };
  private abortSignal = false;

  constructor(db: Database) {
    this.db = db;
    this.writer = new GraphWriter(db);
    // On every startup, any SyncLog still marked 'running' is a crash remnant — mark it failed.
    this._cleanupOrphanedJobs().catch(err =>
      console.error('[SyncOrchestrator] Failed to clean up orphaned jobs:', err)
    );
  }

  private async _cleanupOrphanedJobs(): Promise<void> {
    await this.db.query(`
      FOR log IN SyncLogs
        FILTER log.status == 'running'
        UPDATE log WITH {
          status: 'failed',
          error_message: 'Process terminated unexpectedly (server restarted)',
          end_time: DATE_ISO8601(DATE_NOW())
        } IN SyncLogs
    `);
  }

  public getStatus(): SyncState {
    return this.state;
  }

  public async getLastJobStatus(): Promise<SyncState> {
    try {
      const cursor = await this.db.query(`
        FOR log IN SyncLogs
        SORT log.start_time DESC
        LIMIT 1
        RETURN log
      `);
      if (cursor.hasNext) {
        const log = await cursor.next();
        // A 'running' entry from DB means the previous process crashed before it could finalize.
        // Never surface this as 'running' — nothing is actually running in this process.
        const status: SyncStatus = log.status === 'running' ? 'failed' : log.status;
        return {
          status,
          processed: log.count_success,
          total: log.total_limit ?? (log.count_success + log.count_failure),
          current_prefix: log.prefix,
          job_id: log._key,
          error_message: log.error_message ?? (status === 'failed' ? 'Process terminated unexpectedly (server restarted)' : undefined),
        };
      }
    } catch (error) {
      console.error('[SyncOrchestrator] Error fetching last job status:', error);
    }
    return this.state;
  }

  public async checkDatasetExists(prefix: string): Promise<boolean> {
    const cursor = await this.db.query(
      `FOR log IN SyncLogs FILTER log.prefix == @prefix LIMIT 1 RETURN log`,
      { prefix }
    );
    return cursor.hasNext;
  }

  public stop(): void {
    if (this.state.status === 'running') {
      this.abortSignal = true;
    }
  }

  private async fetchBatch(url: string, params: Record<string, any>): Promise<any> {
    // Retry logic for upstream sources lives in each proxy — no double-retry here.
    return axios.get(url, { params });
  }

  public async sync(
    url: string,
    prefix: string,
    limit = 1000,
    batchSize = 100,
    overwrite = false,
    interBatchSleepMs = 1000,
    ui_config: Record<string, any> = {}
  ): Promise<string> {
    if (this.state.status === 'running') {
      throw new Error('[SyncOrchestrator] A sync is already running.');
    }

    if (overwrite) {
      console.log(`\x1b[33m[SyncOrchestrator] Overwrite is TRUE. Purging existing records for prefix '${prefix}'...\x1b[0m`);
      const targetCollections = ['Dataset', 'Author', 'Keywords', 'HasAuthor', 'HasKeyword'];
      for (const col of targetCollections) {
        await this.db.query(
          `FOR doc IN @@col FILTER doc.source_prefix == @prefix REMOVE doc IN @@col`,
          { '@col': col, prefix }
        );
      }
      await this.db.query(`FOR log IN SyncLogs FILTER log.prefix == @prefix REMOVE log IN SyncLogs`, { prefix });
    }

    const syncLogsCol = this.db.collection('SyncLogs');
    const logDoc = await syncLogsCol.save({
      source_url: url,
      prefix,
      status: 'running',
      count_success: 0,
      count_failure: 0,
      total_limit: limit,
      start_time: new Date().toISOString(),
      ui_config,
    });

    const jobId = logDoc._key;
    this.state = { status: 'running', processed: 0, total: limit, current_prefix: prefix, job_id: jobId };
    this.abortSignal = false;

    // Fire-and-forget: return the job ID immediately while the sync runs in the background.
    this._runSyncBackground(jobId, url, prefix, limit, batchSize, interBatchSleepMs, syncLogsCol).catch(err =>
      console.error('[SyncOrchestrator] Background job critically failed:', err)
    );

    return jobId;
  }

  private async _runSyncBackground(
    jobId: string,
    url: string,
    prefix: string,
    limit: number,
    batchSize: number,
    interBatchSleepMs: number,
    syncLogsCol: any
  ): Promise<void> {
    if (SKIP_PREFIXING_TEST_MODE) {
      console.warn('\x1b[33m[SyncOrchestrator] *** TEST MODE ACTIVE: Prefixing logic will be skipped entirely. ***\x1b[0m');
    }

    console.log(`\x1b[36m[SyncOrchestrator] Initiating handshake with ${url}... (Job ID: ${jobId})\x1b[0m`);
    const validationResult = await this.validator.validate(url);

    if (!validationResult.valid) {
      // Persist to DB first, then update in-memory — keeps the two sources consistent.
      await syncLogsCol.update(jobId, {
        status: 'failed',
        error_message: `Handshake failed: ${validationResult.message}`,
        end_time: new Date().toISOString(),
      });
      this.state.status = 'failed';
      console.error(`\x1b[31m[SyncOrchestrator] Handshake failed: ${validationResult.message}\x1b[0m`);
      return;
    }

    console.log(`\x1b[32m[SyncOrchestrator] Handshake successful. Beginning sync up to ${limit} records in batches of ${batchSize}.\x1b[0m`);

    let paginationToken: string | null = null;
    let hasMoreData = true;
    let batchNumber = 0;
    const expectedBatches = Math.ceil(limit / batchSize);
    const startTime = Date.now();

    try {
      while (this.state.processed < limit && !this.abortSignal && hasMoreData) {
        batchNumber++;
        const params: Record<string, any> = { limit: batchSize };
        if (paginationToken) params.token = paginationToken;

        console.log(`\x1b[36m[SyncOrchestrator] Fetching batch ${batchNumber}/${expectedBatches}...\x1b[0m`);
        const response = await this.fetchBatch(url, params);

        let records: IDataAdapter[];
        let nextToken: string | null;

        // Support both { records, nextToken } envelope and plain array responses.
        if (response.data && !Array.isArray(response.data) && response.data.records) {
          records = response.data.records;
          nextToken = response.data.nextToken ?? null;
        } else {
          records = Array.isArray(response.data) ? response.data : [response.data];
          nextToken = response.headers['x-next-token'] ?? null;
        }

        if (records.length === 0) {
          console.log(`\x1b[33m[SyncOrchestrator] Batch ${batchNumber} returned 0 records — source exhausted.\x1b[0m`);
          hasMoreData = false;
          break;
        }

        const batchPayloads: GraphPayload[] = [];

        for (const record of records) {
          if (this.state.processed >= limit || this.abortSignal) {
            if (this.abortSignal) {
              console.log(`\x1b[33m[SyncOrchestrator] Abort signal received mid-batch ${batchNumber}. Flushing ${batchPayloads.length} already-processed records...\x1b[0m`);
            }
            break;
          }
          const targetRecord = SKIP_PREFIXING_TEST_MODE ? record : this.prefixer.applyPrefix(prefix, record);
          batchPayloads.push(this.extractor.extract(targetRecord));
          this.state.processed++;
        }

        if (batchPayloads.length > 0) {
          await this.writer.writeBatch(batchPayloads, prefix);
          await syncLogsCol.update(jobId, { count_success: this.state.processed });
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          const rps = (this.state.processed / ((Date.now() - startTime) / 1000)).toFixed(1);
          const pct = Math.min(100, Math.floor((this.state.processed / limit) * 100));
          console.log(`\x1b[35m[SyncOrchestrator] [Batch ${batchNumber}/${expectedBatches}] ${this.state.processed}/${limit} records (${pct}%) | ${rps} rec/s | Elapsed: ${elapsedSec}s\x1b[0m`);
        }

        if (nextToken && !this.abortSignal && this.state.processed < limit) {
          paginationToken = nextToken;
          console.log(`\x1b[36m[SyncOrchestrator] Waiting ${interBatchSleepMs / 1000}s before next batch...\x1b[0m`);
          await new Promise(r => setTimeout(r, interBatchSleepMs));
        } else {
          hasMoreData = false;
        }
      }

      // Persist to DB before resetting in-memory state. If the order were reversed and the
      // DB update failed, in-memory would show 'idle' while the DB still shows 'running' —
      // which our startup cleanup would then misread as a crash on next restart.
      const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const avgRps = this.state.processed > 0
        ? (this.state.processed / ((Date.now() - startTime) / 1000)).toFixed(1)
        : '0';
      await syncLogsCol.update(jobId, { status: 'completed', end_time: new Date().toISOString() });
      this.state.status = 'idle';
      console.log(`\x1b[32m[SyncOrchestrator] ✔ Sync complete — ${this.state.processed} records in ${totalSec}s (${avgRps} rec/s avg).\x1b[0m`);
    } catch (err: any) {
      // Same ordering discipline: DB first, then in-memory.
      await syncLogsCol.update(jobId, { status: 'failed', error_message: err.message, end_time: new Date().toISOString() });
      this.state.status = 'failed';
      console.error(`\x1b[31m[SyncOrchestrator] ✘ Sync failed on batch ${batchNumber}/${expectedBatches} at record ${this.state.processed}/${limit}: ${err.message}\x1b[0m`);
    }
  }
}
