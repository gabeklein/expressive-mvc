import { expect, test } from "./fixture";

test("calls a route default's methods through its twin, on an instance the server keeps", async ({ page, open }) => {
  await open("/counter");
  const output = page.locator("output");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(output).toHaveText("0");

  await page.getByRole("button", { name: "Increment" }).click();
  await expect(output).toHaveText("1");

  await page.reload();
  await page.getByRole("button", { name: "Increment" }).click();
  await expect(output).toHaveText("2");
});
