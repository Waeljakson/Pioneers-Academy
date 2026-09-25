import { fileURLToPath } from "node:url";
import { connect } from "./db.js";
import { createApp } from "./app.js";
const { db, close } = connect(process.env.DATABASE_URL);
const production = process.env.NODE_ENV === "production";
const origin = process.env.APP_ORIGIN;
if (!origin || (production && !origin.startsWith("https://")))
  throw new Error("Set APP_ORIGIN (HTTPS required in production)");
const server = createApp(db, {
  origin,
  production,
  staticDir: fileURLToPath(new URL("../dist", import.meta.url)),
}).listen(Number(process.env.PORT ?? 3000), () =>
  console.log("Pioneers Academy server ready"),
);
process.on("SIGTERM", () =>
  server.close(async () => {
    await close();
    process.exit(0);
  }),
);
