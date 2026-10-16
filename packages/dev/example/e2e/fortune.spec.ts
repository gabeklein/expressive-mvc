import { expect, test } from "./fixture";

test("waits out a value still pending on the server, shown once it lands", async ({ page, open }) => {
  await open("/fortune");

  await expect(page.locator("p")).toHaveText("You will ship it.");
});
