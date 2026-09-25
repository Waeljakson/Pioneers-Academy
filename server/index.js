import { fileURLToPath } from "node:url";
import { connect } from "./db.js";
import { createApp } from "./app.js";
import { appOrigin } from "./config.js";
const origin = appOrigin();
const { db, close } = connect(process.env.DATABASE_URL);
const production = process.env.NODE_ENV === "production";
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
