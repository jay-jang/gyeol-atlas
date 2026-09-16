import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    launchOptions: { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] },
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
