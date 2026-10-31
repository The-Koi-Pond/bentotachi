import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// While developing, the app runs on Vite (port 5173) and passes server calls
// on to PocketBase (port 8090). "npm run build" puts the finished app into
// the server's pb_public folder, so PocketBase serves everything by itself.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8090",
      "/_": "http://127.0.0.1:8090",
    },
  },
  build: {
    outDir: "../server/pb_public",
    emptyOutDir: true,
  },
});
