import { Database } from 'arangojs';
import axios from 'axios';
import { setTimeout as sleep } from 'timers/promises';
import { checkRecord, describeFetchError } from './validation/HandshakeValidator';
import { PrefixingService } from './services/PrefixingService';
import { RelationExtractor } from './services/RelationExtractor';
import { GraphWriter } from './services/GraphWriter';
import { IDataAdapter } from './contracts/IDataAdapter';

export type SyncStatus = 'idle' | 'running' | 'stopped' | 'failed' | 'completed';

export interface SyncState {
  status: SyncStatus;
  processed: number;
  total: number;
  current_prefix: string;
  job_id?: string;
  error_message?: string;
  source_url?: string;
  stopping?: boolean; // Stop was requested and the job is winding down
}

// Thrown by sync()/resume() while another import runs; the router answers 409.
export class SyncBusyError extends Error {
  constructor() {
    super('An import is already running. Stop it first.');
  }
}

// Above the proxies' own worst case (3 tries x 45 s + 28 s backoff), so a slow-but-alive source
// still gets through while a hung one fails instead of blocking the job forever.
const FETCH_TIMEOUT_MS = 180_000;

const IDLE: SyncState = { status: 'idle', processed: 0, total: 0, current_prefix: '' };

interface HarvestJob {
  id: string;
  url: string;
  prefix: string;
  limit: number;
  batchSize: number;
  sleepMs: number;
  token: string | null;  // null = start from the first page
  validated: boolean;    // the first page already passed checkRecord (a resumed job that wrote data)
  overwrite: boolean;    // purge the label's old data, but only once the first page has passed
}

export class SyncOrchestrator {
  private prefixer = new PrefixingService();
  private extractor = new RelationExtractor();
  private writer: GraphWriter;
  private state: SyncState = { ...IDLE };
  // One controller per job: stop() aborts its in-flight page fetch and the pause between batches.
  private abort: AbortController | null = null;

  constructor(private db: Database) {
    this.writer = new GraphWriter(db);
    // On every startup, any SyncLog still marked 'running' is a crash remnant — mark it failed.
    this._cleanupOrphanedJobs().catch(err =>
      console.error('[SyncOrchestrator] Failed to clean up orphaned jobs:', err)
    );
  }

  private get logs() {
    return this.db.collection('SyncLogs');
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

  // Clears in-memory state, e.g. so /sync/status doesn't surface a deleted job once SyncLogs is empty.
  public resetState(): void {
    this.state = { ...IDLE };
    this.abort = null;
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
        // A 'running' entry while nothing runs in this process means the previous process crashed.
        const status: SyncStatus = log.status === 'running' ? 'failed' : log.status;
        return {
          status,
          processed: log.count_success,
          total: log.total_limit ?? (log.count_success + log.count_failure),
          current_prefix: log.prefix,
          job_id: log._key,
          source_url: log.source_url,
          error_message: log.error_message ?? (status === 'failed' ? 'Process terminated unexpectedly (server restarted)' : undefined),
        };
      }
    } catch (error) {
      console.error('[SyncOrchestrator] Error fetching last job status:', error);
    }
    return this.state;
  }

  // Removes every trace of a source by prefix (except the job doing an overwrite, if given). Data
  // collections first, SyncLogs last, so a partial failure leaves the source listed and the call
  // safe to retry. 6 sequential removes, not a DB transaction; wrap in db.beginTransaction if a
  // half-deleted source ever shows up in practice.
  public async purgeSource(prefix: string, keepJobId = ''): Promise<void> {
    const targetCollections = ['Dataset', 'Author', 'Keywords', 'HasAuthor', 'HasKeyword'];
    for (const col of targetCollections) {
      await this.db.query(
        `FOR doc IN @@col FILTER doc.source_prefix == @prefix REMOVE doc IN @@col`,
        { '@col': col, prefix }
      );
    }
    await this.db.query(
      `FOR log IN SyncLogs FILTER log.prefix == @prefix AND log._key != @keep REMOVE log IN SyncLogs`,
      { prefix, keep: keepJobId }
    );
  }

  public stop(): void {
    if (this.state.status !== 'running' || !this.abort) return;
    this.state.stopping = true;
    this.abort.abort();
  }

  // Marks a job as running *before* any await, so two near-simultaneous requests can't both start one.
  private claim(next: Partial<SyncState>): void {
    if (this.state.status === 'running') throw new SyncBusyError();
    this.state = { ...IDLE, ...next, status: 'running' };
    this.abort = new AbortController();
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
    this.claim({ total: limit, current_prefix: prefix, source_url: url });
    let id: string;
    try {
      const doc = await this.logs.save({
        source_url: url,
        prefix,
        status: 'running',
        count_success: 0,
        count_failure: 0,
        total_limit: limit,
        batch_size: batchSize,
        inter_batch_sleep_ms: interBatchSleepMs,
        start_time: new Date().toISOString(),
        resume_token: null,
        ui_config,
      });
      id = doc._key;
    } catch (err) {
      this.resetState();
      throw err;
    }
    this.state.job_id = id;
    this.start({ id, url, prefix, limit, batchSize, sleepMs: interBatchSleepMs, token: null, validated: false, overwrite });
    return id;
  }

  public async resume(jobId: string): Promise<string> {
    this.claim({ job_id: jobId });
    let job: HarvestJob;
    try {
      const cursor = await this.db.query(
        `FOR log IN SyncLogs FILTER log._key == @key LIMIT 1 RETURN log`,
        { key: jobId }
      );
      if (!cursor.hasNext) throw new Error(`Job ${jobId} not found.`);
      const log = await cursor.next();
      await this.logs.update(jobId, { status: 'running', error_message: null, end_time: null });

      const processed = log.count_success ?? 0;
      const limit = log.total_limit ?? processed;
      this.state = { ...this.state, processed, total: limit, current_prefix: log.prefix, source_url: log.source_url };
      job = {
        id: jobId,
        url: log.source_url,
        prefix: log.prefix,
        limit,
        batchSize: log.batch_size ?? 100,
        sleepMs: log.inter_batch_sleep_ms ?? 1000,
        token: log.resume_token ?? null,
        validated: processed > 0, // a job that never wrote anything re-checks its first page
        overwrite: false,
      };
    } catch (err) {
      this.resetState();
      throw err;
    }
    this.start(job);
    return jobId;
  }

  // Fire-and-forget: the caller gets the job ID right away; harvest() records its own outcome.
  private start(job: HarvestJob): void {
    const signal = this.abort!.signal;
    this.harvest(job, signal).catch(err =>
      console.error(`[SyncOrchestrator] Job ${job.id}: could not record its outcome:`, err)
    );
  }

  private async fetchPage(url: string, limit: number, token: string | null, signal: AbortSignal) {
    const params: Record<string, any> = { limit };
    if (token) params.token = token;
    const res = await axios.get(url, { params, signal, timeout: FETCH_TIMEOUT_MS });
    const body = res.data;
    // A proxy answers either IDataAdapter[] (+ X-Next-Token header) or a { records, nextToken } envelope.
    if (body && !Array.isArray(body) && Array.isArray(body.records)) {
      return { records: body.records as IDataAdapter[], nextToken: (body.nextToken ?? null) as string | null };
    }
    return {
      records: (Array.isArray(body) ? body : [body]) as IDataAdapter[],
      nextToken: (res.headers['x-next-token'] ?? null) as string | null,
    };
  }

  private async harvest(job: HarvestJob, signal: AbortSignal): Promise<void> {
    const { id, url, prefix, limit, batchSize, sleepMs } = job;
    let { token, validated } = job;
    const started = Date.now();
    console.log(`\x1b[36m[SyncOrchestrator] Job ${id}: harvesting up to ${limit} records from ${url}${token ? ' (resuming)' : ''}\x1b[0m`);

    try {
      while (this.state.processed < limit) {
        const { records, nextToken } = await this.fetchPage(url, batchSize, token, signal);

        if (!validated) {
          // The first page doubles as the handshake: check it before touching any existing data.
          const problem = checkRecord(records[0]);
          if (problem) throw new Error(problem);
          validated = true;
          if (job.overwrite) await this.purgeSource(prefix, id);
        }
        if (records.length === 0) break; // source exhausted

        const take = records.slice(0, limit - this.state.processed);
        await this.writer.writeBatch(take.map(r => this.extractor.extract(this.prefixer.applyPrefix(prefix, r))), prefix);
        this.state.processed += take.length;
        await this.logs.update(id, { count_success: this.state.processed, resume_token: nextToken });

        const rps = (this.state.processed / Math.max(1, (Date.now() - started) / 1000)).toFixed(1);
        console.log(`\x1b[35m[SyncOrchestrator] Job ${id}: ${this.state.processed}/${limit} records | ${rps} rec/s\x1b[0m`);

        if (!nextToken) break;
        token = nextToken;
        if (this.state.processed < limit) await sleep(sleepMs, undefined, { signal });
      }
      await this.finish(id, 'completed');
    } catch (err: any) {
      // A stop aborts the in-flight fetch or the pause. The page being fetched is dropped and the
      // stored resume_token still points at it, so Resume picks up exactly there.
      if (signal.aborted) return this.finish(id, 'stopped');
      const reason = describeFetchError(err);
      await this.finish(id, 'failed', validated ? reason : `Handshake failed: ${reason}`);
    }
  }

  // DB first, then memory. If the DB write fails, the row stays 'running' (the startup cleanup marks
  // it failed later), but memory is always released so a new import can start.
  private async finish(id: string, status: SyncStatus, error_message?: string): Promise<void> {
    try {
      await this.logs.update(id, { status, error_message: error_message ?? null, end_time: new Date().toISOString() });
    } finally {
      this.state = { ...this.state, status, error_message, stopping: false };
      this.abort = null;
      const colour = status === 'completed' ? 32 : status === 'stopped' ? 33 : 31;
      console.log(`\x1b[${colour}m[SyncOrchestrator] Job ${id}: ${status} at ${this.state.processed}/${this.state.total}${error_message ? ` — ${error_message}` : ''}\x1b[0m`);
    }
  }
}
