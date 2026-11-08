// @vitest-environment happy-dom

import { expect, it } from "vitest";

import { mount } from "../../test.setup";
import { NotFound } from "./not-found";

it("will render the default 404 page", async () => {
  const root = await mount(NotFound);

  expect(root.querySelector("h1")!.textContent).toBe("404 - Not found");
});
