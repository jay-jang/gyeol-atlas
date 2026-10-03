import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  // Every system is present from 0%, so each page load decodes all nine
  // male models (about 64 MB) under software WebGL before the scene is ready.
  timeout: 150000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    // Camera moves glide unless reduced motion is preferred; specs compare
    // settled poses, and camera-glide.spec.ts opts back into motion.
    reducedMotion: "reduce",
    // Software WebGL by default; PLAYWRIGHT_GPU=1 uses the local GPU (macOS Metal)
    // for a realistic frame cost. Record which renderer a verification used.
    launchOptions: { args: process.env.PLAYWRIGHT_GPU === "1"
      ? ["--no-sandbox", "--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"]
      : ["--no-sandbox", "--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5174/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  workers: 1,
});
