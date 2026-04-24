import { Database } from "arangojs";
import dotenv from "dotenv";
import { BasicAuthCredentials } from "arangojs/connection";

// load .env file
dotenv.config();

const defaultDatabaseName = process.env.ARANGO_DB_NAME;

const requireEnv = (key: "ARANGO_URL" | "ARANGO_USER" | "ARANGO_PASS"): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

/** Create a database client, defaulting to ARANGO_DB_NAME when not provided. */
export function createDb(databaseName?: string) {
  const resolvedDatabaseName = databaseName ?? defaultDatabaseName;
  if (!resolvedDatabaseName) {
    throw new Error("Missing database name. Provide ARANGO_DB_NAME or pass databaseName.");
  }

  return new Database({
    url: requireEnv("ARANGO_URL"),
    databaseName: resolvedDatabaseName,
    auth: <BasicAuthCredentials>{
      username: requireEnv("ARANGO_USER"),
      password: requireEnv("ARANGO_PASS"),
    },
  });
}

// Establish default connection to database (env-based)
const db = createDb();

const isDatabaseNotFoundError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { errorNum?: number; message?: string };
  return (
    anyErr.errorNum === 1228 || // ArangoDB: database not found
    /database.*not found|not found/i.test(anyErr.message ?? "")
  );
};

async function ensureDatabaseExists(databaseName: string): Promise<void> {
  const systemDb = new Database({
    url: requireEnv("ARANGO_URL"),
    databaseName: "_system",
    auth: <BasicAuthCredentials>{
      username: requireEnv("ARANGO_USER"),
      password: requireEnv("ARANGO_PASS"),
    },
  });

  const dbs = await systemDb.listDatabases();
  if (!dbs.includes(databaseName)) {
    await systemDb.createDatabase(databaseName);
    console.log(`[database] Created database "${databaseName}"`);
  }
}

// function to test database connection
export async function connectArango(databaseName?: string): Promise<void> {
  const resolvedDatabaseName = databaseName ?? defaultDatabaseName;
  if (!resolvedDatabaseName) {
    throw new Error("Missing database name. Provide ARANGO_DB_NAME or pass databaseName.");
  }

  let targetDb = databaseName ? createDb(databaseName) : db;

  try {
    const info = await targetDb.version();
    console.log(
      `[database] Connected to "${resolvedDatabaseName}" on ${requireEnv("ARANGO_URL")} (version ${info.version})`
    );
  } catch (err) {
    if (isDatabaseNotFoundError(err) && resolvedDatabaseName !== "_system") {
      console.warn(
        `[database] "${resolvedDatabaseName}" not found. Creating it now...`
      );
      await ensureDatabaseExists(resolvedDatabaseName);
      targetDb = createDb(resolvedDatabaseName);

      const info = await targetDb.version();
      console.log(
        `[database] Connected to newly created "${resolvedDatabaseName}" on ${requireEnv("ARANGO_URL")} (version ${info.version})`
      );
      return;
    }

    console.error(`[database] Failed to connect to "${resolvedDatabaseName}"`, err);
    throw err;
  }
}

export { db };
