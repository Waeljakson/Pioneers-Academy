import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { connect, query } from "../server/db.js";
import { pathToFileURL } from "node:url";
export async function migrate(db) {
  await db.transaction(async (tx) => {
    await query(tx, "SELECT pg_advisory_xact_lock(728491)");
    await query(
      tx,
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const folder = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(folder))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const source = await readFile(new URL(name, folder), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const [existing] = await query(
        tx,
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(`Migration changed: ${name}`);
        continue;
      }
      // The migration files are maintained SQL, never user input.
      for (const statement of source
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await query(tx, statement);
      await query(
        tx,
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { db, close } = connect(process.env.DATABASE_URL_DIRECT);
  try {
    await migrate(db);
    console.log("Migrations applied");
  } finally {
    await close();
  }
}
