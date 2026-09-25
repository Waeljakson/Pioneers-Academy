// Local-only disposable preview. Never used by npm start or production.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";
import { createApp } from "../server/app.js";
if (process.env.NODE_ENV === "production")
  throw new Error("Preview is disabled in production");
const client = new PGlite(),
  db = drizzle(client);
await migrate(db);
const password =
  process.env.PREVIEW_PASSWORD ?? randomBytes(15).toString("base64url");
await seed(db, {
  email: "admin@example.test",
  password,
  demo: true,
  demoPassword: password,
});
createApp(db, {
  origin: "http://localhost:3000",
  staticDir: fileURLToPath(new URL("../dist", import.meta.url)),
}).listen(3000, "127.0.0.1", () => {
  console.log("Disposable local preview: http://localhost:3000");
  console.log(
    "Accounts: admin@example.test / student@example.test / lecturer@example.test",
  );
  console.log("Temporary preview password:", password);
});
