import { test as base, expect } from '@playwright/test';

export type Host = 'react' | 'dom';

export const test = base.extend<{ host: Host; open: (path: string) => Promise<void> }>({
  host: async ({}, use, info) => {
    await use(info.project.name as Host);
  },

  open: async ({ page, host }, use) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() == 'error' && !message.text().startsWith('Failed to load resource'))
        errors.push(message.text());
    });

    await use(async (path) => {
      await page.goto(`${host == 'dom' ? 'dom.html' : ''}?page=${path}`);
      await page.locator('#root > *').first().waitFor();
    });

    expect(errors, 'page errors and console.error').toEqual([]);
  }
});

export { expect };
