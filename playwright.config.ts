import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}",
  use: {
    trace: "on-first-retry",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "root", use: { baseURL: "http://127.0.0.1:4173/" } },
    { name: "repository-base", use: { baseURL: "http://127.0.0.1:4174/repository/" } },
    {
      name: "mobile-reader",
      use: {
        baseURL: "http://127.0.0.1:4173/",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "RHIZOME_BASE_PATH=/repository/ npm run dev -- --host 127.0.0.1 --port 4174",
      url: "http://127.0.0.1:4174/repository/",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
