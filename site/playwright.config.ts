import { defineConfig } from "@playwright/test";

const dev = 3201;
const prod = 3202;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    browserName: "chromium",
    launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : {},
  },
  projects: [
    { name: "dev", use: { baseURL: `http://localhost:${dev}/` } },
    { name: "prod", use: { baseURL: `http://localhost:${prod}/` } },
  ],
  webServer: [
    { command: `rm -rf node_modules/.vite && PORT=${dev} expressive dev`, port: dev, reuseExistingServer: false },
    { command: `expressive build && PORT=${prod} node dist/server/index.js`, port: prod, reuseExistingServer: false },
  ],
});
