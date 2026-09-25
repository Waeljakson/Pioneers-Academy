import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/Pioneers-Academy/",
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
  build: { sourcemap: false },
});
