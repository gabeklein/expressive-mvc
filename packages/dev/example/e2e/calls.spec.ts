import { expect, test } from "./fixture";

test("calls a sidecar's functions on the server", async ({ page, open }, { project }) => {
  await open("/tally");
  const output = page.locator("output");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(output).toHaveText("undefined");

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(output).toHaveText("1");

  await page.reload();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(output).toHaveText("2");

  await page.getByRole("button", { name: "Add 10" }).click();
  await expect(output).toHaveText("Overflow at 9");

  await page.getByRole("button", { name: "Where" }).click();
  await expect(output).toHaveText("/tally");

  await page.getByRole("button", { name: "Fail" }).click();
  await expect(output).toHaveText(project.name == "dev" ? "Nope" : "Internal error.");
});
