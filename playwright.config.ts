import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  workers: 2,
  use: { baseURL: "http://127.0.0.1:4173/project-manager-training-1/", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "small-mobile", use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: { command: "npm run preview", port: 4173, reuseExistingServer: !process.env.CI },
});
