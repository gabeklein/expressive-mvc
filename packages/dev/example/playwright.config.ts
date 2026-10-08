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
    { command: `rm -rf node_modules/.vite && PORT=${dev} bun run dev`, port: dev, reuseExistingServer: false },
    { command: `bun run build && PORT=${prod} bun run start`, port: prod, reuseExistingServer: false },
  ],
});
