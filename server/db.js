import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
export function connect(url) {
  if (!url) throw new Error("DATABASE_URL is required on the server");
  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
  return { db: drizzle(pool), close: () => pool.end() };
}
// Convert positional parameters to Drizzle bound values. SQL structure is internal only.
export function statement(text, values = []) {
  const parts = text.split(/\$(\d+)/g);
  return sql.join(
    parts.map((part, i) =>
      i % 2 ? sql`${values[Number(part) - 1]}` : sql.raw(part),
    ),
    sql.raw(""),
  );
}
export async function query(db, text, values = []) {
  const result = await db.execute(statement(text, values));
  return result.rows;
}
