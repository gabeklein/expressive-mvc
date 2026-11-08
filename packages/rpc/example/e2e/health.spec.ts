import { expect, test } from "@playwright/test";

test("will answer the entry's own route, from the same modules the calls use", async ({ page, request }) => {
  const health = async () => (await (await request.get("/health")).json()) as { ok: boolean; todos: number };
  const before = await health();

  expect(before.ok).toBe(true);

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in as alice" }).click();
  await page.getByPlaceholder("What needs doing?").fill(`Count me ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("alert")).toBeEmpty();

  await expect(async () => expect((await health()).todos).toBeGreaterThan(before.todos)).toPass();
});
