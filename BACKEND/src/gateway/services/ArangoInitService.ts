import { CollectionType } from "arangojs/collection";
import { db } from "../../database";
import dotenv from "dotenv";

dotenv.config();

const RESET_DB = false;

export class ArangoInitService {
  static async init() {
    console.log("Initializing ArangoDB...");
    const dbName = process.env.ARANGO_DB_NAME || "vesa2db";
    const docCollections = ["Dataset", "Author", "Keywords", "SyncLogs"];
    const edgeCollections = ["HasAuthor", "HasKeyword"];

    try {
      const systemDb = db.database("_system");
      const databases = await systemDb.listDatabases();

      if (RESET_DB && databases.includes(dbName)) {
        console.log(`RESET_DB is true. Dropping database ${dbName}...`);
        await systemDb.dropDatabase(dbName);
      }

      if (!databases.includes(dbName) || RESET_DB) {
        console.log(`Creating database ${dbName}...`);
        await systemDb.createDatabase(dbName);
      }

      const targetDb = db.database(dbName);

      for (const name of docCollections) {
        const col = targetDb.collection(name);
        if (!(await col.exists())) {
          console.log(`Creating document collection: ${name}`);
          await col.create();
        }
      }

      for (const name of edgeCollections) {
        const col = targetDb.collection(name);
        if (!(await col.exists())) {
          console.log(`Creating edge collection: ${name}`);
          await col.create({ type: CollectionType.EDGE_COLLECTION });
        }
      }

      console.log("ArangoDB initialization complete.");
    } catch (error) {
      console.error("ArangoDB initialization failed:", error);
      throw error;
    }
  }
}
