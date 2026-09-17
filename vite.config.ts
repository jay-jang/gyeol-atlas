import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    // Keep CSS builds portable on macOS runners where native Lightning CSS
    // bindings can be rejected by library validation. Vite still bundles CSS.
    cssMinify: false,
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
