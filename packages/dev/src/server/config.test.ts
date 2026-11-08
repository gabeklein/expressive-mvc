import { expect, it } from "vitest";

import { config } from "./config";

it("will return the config it is given", () => {
  const options = { port: 3000 };

  expect(config(options)).toBe(options);
});
