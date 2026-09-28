import { defineConfig } from '@playwright/test';

const react = 5180;
const dom = 5181;

export default defineConfig({
  testMatch: ['pages/**/*.spec.ts', 'coverage.spec.ts'],
  fullyParallel: true,
  workers: process.env.CI ? '100%' : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { browserName: 'chromium' },
  projects: [
    { name: 'react', use: { baseURL: `http://localhost:${react}/` } },
    { name: 'dom', use: { baseURL: `http://localhost:${dom}/` } }
  ],
  webServer: [
    { command: `bun run dev --port ${react} --strictPort`, port: react, reuseExistingServer: !process.env.CI },
    { command: `bun run dev:dom --port ${dom} --strictPort`, port: dom, reuseExistingServer: !process.env.CI }
  ]
});
