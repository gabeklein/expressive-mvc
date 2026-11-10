import { expect, it, vi } from "vitest";

const build = vi.hoisted(() => vi.fn(async () => {}));

const prerender = vi.hoisted(() => vi.fn(async () => []));

vi.mock("vite", async importOriginal => ({ ...(await importOriginal<object>()), build }));
vi.mock("./prerender", () => ({ prerender }));

import { clientBuild, runBuild, serverBuild } from "./build";

it("will build the client, then the server", async () => {
  await runBuild("/app", { pretty: true });

  expect(build.mock.calls.map(([config]: any) => config.build.outDir)).toEqual(["dist/client", "dist/server"]);
  expect(build.mock.calls[0]).toMatchObject([{ root: "/app", build: { minify: false } }]);
});

it("will prerender only when asked, after both builds", async () => {
  build.mockClear();

  await runBuild("/app", {});
  expect(prerender).not.toHaveBeenCalled();

  await runBuild("/app", { prerender: true });
  expect(prerender).toHaveBeenCalledWith("/app");
  expect(build).toHaveBeenCalledTimes(4);
});

it("will build the working directory by default", async () => {
  build.mockClear();

  await runBuild();

  expect(build).toHaveBeenCalledWith(expect.objectContaining({ root: process.cwd() }));
});

it("will minify and write by default", () => {
  expect(clientBuild("/app").build).toMatchObject({ minify: true, write: true });
  expect(serverBuild("/app").build).toMatchObject({ write: true });
});
