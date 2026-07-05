import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    // use the environment's preinstalled Chromium when the pinned
    // @playwright/test version doesn't match the downloaded browsers
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/Scoring/",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
