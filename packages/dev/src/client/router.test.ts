import { afterEach, expect, it, vi } from "vitest";

import { Router } from "./router";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("will move without history where there is no window", async () => {
  const router = Router.new();

  router.goto("/next?q=1");
  await Promise.resolve();

  expect(router.path).toBe("/next");
  router.set(null);
});

it("will push history in a browser", async () => {
  const pushState = vi.fn();

  vi.stubGlobal("window", { location: { pathname: "/", search: "", hash: "" }, addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("history", { pushState, replaceState: vi.fn() });

  const router = Router.new();

  router.goto("/next");
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(pushState).toHaveBeenCalledWith(null, "", "/next");
  router.set(null);
});
