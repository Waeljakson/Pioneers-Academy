import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { appOrigin } from "../server/config.js";
import { initializeDeployment } from "../scripts/deploy.js";
import { query } from "../server/db.js";
test("Render origin is inferred and insecure production origins are rejected", () => {
  assert.equal(
    appOrigin({
      NODE_ENV: "production",
      RENDER_EXTERNAL_URL: "https://example.onrender.com/",
    }),
    "https://example.onrender.com",
  );
  assert.equal(
    appOrigin({
      NODE_ENV: "production",
      APP_ORIGIN: "https://academy.example/",
      RENDER_EXTERNAL_URL: "https://example.onrender.com",
    }),
    "https://academy.example",
  );
  for (const APP_ORIGIN of [
    "http://example.test",
    "https://example.test/path",
    "https://name:password@example.test",
    "javascript:alert(1)",
  ])
    assert.throws(() => appOrigin({ NODE_ENV: "production", APP_ORIGIN }));
  assert.throws(() => appOrigin({}));
});
test("first deploy creates only admin and repeat deploy preserves accounts without secrets", async () => {
  const client = new PGlite(),
    db = drizzle(client);
  try {
    const env = {
      SEED_ADMIN_EMAIL: "owner@example.test",
      SEED_ADMIN_PASSWORD: "test-only-long-password",
      SEED_DEMO: "true",
    };
    assert.equal((await initializeDeployment(db, env)).created, true);
    const [user] = await query(db, "SELECT * FROM users");
    assert.equal(user.email, env.SEED_ADMIN_EMAIL);
    assert.equal((await query(db, "SELECT * FROM students")).length, 0);
    assert.equal((await initializeDeployment(db, {})).created, false);
    assert.deepEqual(await query(db, "SELECT id,password_hash FROM users"), [
      { id: user.id, password_hash: user.password_hash },
    ]);
    assert.equal((await query(db, "SELECT * FROM program_types")).length, 4);
  } finally {
    await client.close();
  }
});
