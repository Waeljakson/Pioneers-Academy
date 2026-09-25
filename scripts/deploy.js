import { pathToFileURL } from "node:url";
import { connect, query } from "../server/db.js";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";
export async function initializeDeployment(db, env = process.env) {
  await migrate(db);
  return db.transaction(async (tx) => {
    await query(tx, "SELECT pg_advisory_xact_lock(728493)");
    const [existing] = await query(tx, "SELECT id FROM users LIMIT 1");
    if (existing) return { created: false };
    await seed(tx, {
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
      demo: false,
    });
    return { created: true };
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { db, close } = connect(process.env.DATABASE_URL_DIRECT);
  try {
    const result = await initializeDeployment(db);
    console.log(
      result.created
        ? "Database initialized; administrator created"
        : "Database ready; existing accounts preserved",
    );
  } catch {
    console.error(
      "Deployment initialization failed. Check the independent database connection and initial administrator settings.",
    );
    process.exitCode = 1;
  } finally {
    await close();
  }
}
