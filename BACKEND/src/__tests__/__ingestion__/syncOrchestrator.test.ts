import http from "http";
import { AddressInfo } from "net";
import { SyncOrchestrator, SyncBusyError } from "../../ingestion/SyncOrchestrator";
import { RelationExtractor } from "../../ingestion/services/RelationExtractor";

// Real HTTP source (so axios abort/timeout paths run) + in-memory fake ArangoDB.
// The source pages by numeric token; pages from `slow.fromToken` on wait `slow.ms` before answering.
const slow = { fromToken: Infinity, ms: 0 };
const record = (i: number) => ({
  dataset: { id: `ds${i}`, title: `T${i}`, temporal: { start: "2000-01-01", end: "2001-01-01" } },
  authors: [{ id: `a${i % 3}`, firstName: "A", lastName: "B" }],
  keywords: [{ id: `k${i % 2}`, name: "kw" }],
});

let server: http.Server;
let base = "";
beforeAll((done) => {
  server = http
    .createServer((req, res) => {
      const u = new URL(req.url!, "http://x");
      const json = (body: unknown, next?: number) => {
        if (res.destroyed) return;
        if (next !== undefined) res.setHeader("X-Next-Token", String(next));
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
      };
      if (u.pathname === "/bad") return json([{ not: "an IDataAdapter" }]);
      const token = Number(u.searchParams.get("token") ?? 0);
      const limit = Number(u.searchParams.get("limit") ?? 10);
      const page = Array.from({ length: limit }, (_, i) => record(token + i));
      setTimeout(() => json(page, token + limit), token >= slow.fromToken ? slow.ms : 0).unref(); // aborted pages must not keep jest alive
    })
    .listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      done();
    });
});
afterAll((done) => {
  server.closeAllConnections();
  server.close(done);
});
beforeEach(() => Object.assign(slow, { fromToken: Infinity, ms: 0 }));

function fakeDb() {
  const logs = new Map<string, any>();
  const datasets = new Set<string>();
  const removes: string[] = [];
  let nextKey = 1;
  const db: any = {
    logs,
    datasets,
    removes,
    query: async (q: string, vars: any = {}) => {
      if (q.includes("REMOVE")) removes.push(q);
      const hit = q.includes("log._key == @key") ? logs.get(vars.key) : undefined;
      return { hasNext: !!hit, next: async () => hit, all: async () => (hit ? [hit] : []) };
    },
    collection: (name: string) =>
      name === "SyncLogs"
        ? {
            save: async (doc: any) => {
              const _key = String(nextKey++);
              logs.set(_key, { ...doc, _key });
              return { _key };
            },
            update: async (key: string, patch: any) => logs.set(key, { ...logs.get(key), ...patch }),
          }
        : {
            save: async (docs: any[]) => {
              if (name === "Dataset") docs.forEach((d) => datasets.add(d._key));
              return [];
            },
          },
  };
  return db;
}

const until = async (cond: () => boolean, ms = 3000) => {
  const t = Date.now();
  while (!cond()) {
    if (Date.now() - t > ms) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe("SyncOrchestrator", () => {
  it("Stop aborts the in-flight page at once, records 'stopped', and Resume continues with no gap", async () => {
    const db = fakeDb();
    const o = new SyncOrchestrator(db);
    slow.fromToken = 20; // pages 1-2 instant, page 3 hangs for 5 s
    slow.ms = 5000;
    const id = await o.sync(`${base}/records`, "src", 30, 10, false, 0);
    await until(() => o.getStatus().processed === 20);
    await new Promise((r) => setTimeout(r, 50)); // now waiting on the slow page 3

    const t0 = Date.now();
    o.stop();
    await until(() => o.getStatus().status !== "running");
    expect(Date.now() - t0).toBeLessThan(1000); // not after the 5 s page
    expect(o.getStatus().status).toBe("stopped");
    expect(db.logs.get(id)).toMatchObject({ status: "stopped", count_success: 20, resume_token: "20" });

    slow.fromToken = Infinity;
    await o.resume(id);
    await until(() => o.getStatus().status !== "running");
    expect(db.logs.get(id)).toMatchObject({ status: "completed", count_success: 30 });
    expect(db.datasets.size).toBe(30); // ds0..ds29, nothing skipped by the stop
  });

  it("refuses a second import while one runs (claimed before any await)", async () => {
    const o = new SyncOrchestrator(fakeDb());
    slow.fromToken = 0;
    slow.ms = 5000;
    const first = o.sync(`${base}/records`, "a", 10, 10, false, 0);
    await expect(o.sync(`${base}/records`, "b", 10, 10, false, 0)).rejects.toBeInstanceOf(SyncBusyError);
    await first;
    o.stop();
    await until(() => o.getStatus().status !== "running");
  });

  it("an overwrite only purges after the first page passes the handshake", async () => {
    const db = fakeDb();
    const o = new SyncOrchestrator(db);

    const bad = await o.sync(`${base}/bad`, "src", 10, 10, true, 0);
    await until(() => o.getStatus().status !== "running");
    expect(db.logs.get(bad).status).toBe("failed");
    expect(db.logs.get(bad).error_message).toMatch(/^Handshake failed: Missing required dataset fields/);
    expect(db.removes).toHaveLength(0); // old data untouched

    await o.sync(`${base}/records`, "src", 10, 10, true, 0);
    await until(() => o.getStatus().status !== "running");
    expect(o.getStatus().status).toBe("completed");
    expect(db.removes.length).toBeGreaterThan(0);
  });
});

describe("RelationExtractor edge keys", () => {
  it("are deterministic, so re-imports upsert instead of duplicating edges", () => {
    const x = new RelationExtractor();
    const a = x.extract(record(1) as any);
    const b = x.extract(record(1) as any);
    const c = x.extract(record(2) as any);
    expect(a.edgesHasKeyword[0]._key).toBe(b.edgesHasKeyword[0]._key);
    expect(a.edgesHasAuthor[0]._key).not.toBe(c.edgesHasAuthor[0]._key);
  });
});
