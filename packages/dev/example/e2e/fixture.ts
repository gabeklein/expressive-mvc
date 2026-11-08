import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ open: (path: string) => Promise<void> }>({
  open: async ({ page }, use) => {
    const errors: string[] = [];

    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      const text = message.text();
      const network = text.startsWith("Failed to load resource");

      if (message.type() == "error" && !network) errors.push(text);
    });

    await use(async path => {
      await page.goto(path);
      await page.locator("#root h1").first().waitFor();
    });

    expect(errors, "page errors and console.error").toEqual([]);
  },
});

export { expect };
