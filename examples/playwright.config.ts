import { defineConfig } from '@playwright/test';

const react = 5180;
const dom = 5181;

export default defineConfig({
  testMatch: ['pages/**/*.spec.ts', 'coverage.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { browserName: 'chromium' },
  projects: [
    { name: 'react', use: { baseURL: `http://localhost:${react}/` } },
    { name: 'dom', use: { baseURL: `http://localhost:${dom}/` } }
  ],
  webServer: [
    { command: `../node_modules/.bin/vite --port ${react} --strictPort`, port: react, reuseExistingServer: !process.env.CI },
    { command: `../node_modules/.bin/vite --mode dom --port ${dom} --strictPort`, port: dom, reuseExistingServer: !process.env.CI }
  ]
});
