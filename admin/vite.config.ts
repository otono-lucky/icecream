import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The admin website. Talks to the same API as the app (VITE_API_URL, default the local Worker).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@contracts": fileURLToPath(new URL("../contracts/index.ts", import.meta.url)) } },
  server: { port: 5173, strictPort: true },
});
