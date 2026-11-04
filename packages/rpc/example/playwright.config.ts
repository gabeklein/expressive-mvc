import { defineConfig } from "@playwright/test";

const dev = 3201;
const node = 3202;
const worker = 3203;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    browserName: "chromium",
    trace: process.env.CI ? "retain-on-failure" : "off",
    launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : {},
  },
  testIgnore: "edit.spec.ts",
  projects: [
    { name: "dev", use: { baseURL: `http://localhost:${dev}/` } },
    { name: "dev edits", testMatch: "edit.spec.ts", testIgnore: [], dependencies: ["dev"], use: { baseURL: `http://localhost:${dev}/` } },
    { name: "node", use: { baseURL: `http://localhost:${node}/` } },
    { name: "worker", use: { baseURL: `http://localhost:${worker}/` } },
  ],
  webServer: [
    { command: `rm -rf node_modules/.vite ../node_modules/.vite && vite --port ${dev} --strictPort`, port: dev, reuseExistingServer: false },
    { command: `PORT=${node} node server.js`, port: node, reuseExistingServer: false },
    { command: `wrangler dev --port ${worker}`, port: worker, reuseExistingServer: false, env: { WRANGLER_SEND_METRICS: "false" } },
  ],
});
