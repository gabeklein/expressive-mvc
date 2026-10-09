import { defineConfig } from "@playwright/test";

const dev = 3101;
const prod = 3102;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    browserName: "chromium",
    launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : {},
  },
  projects: [
    { name: "dev", use: { baseURL: `http://localhost:${dev}/` } },
    { name: "prod", use: { baseURL: `http://localhost:${prod}/` } },
  ],
  webServer: [
    { command: `rm -rf node_modules/.vite && PORT=${dev} node ../dist/cli.js dev`, port: dev, reuseExistingServer: false },
    { command: `node ../dist/cli.js build && PORT=${prod} node dist/server/index.js`, port: prod, reuseExistingServer: false },
  ],
});
