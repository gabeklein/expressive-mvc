import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";

const MANIFEST = fileURLToPath(new URL("../package.json", import.meta.url));

function targets(node: unknown): string[] {
  if (typeof node == "string") return [node];

  return Object.values(node as object).flatMap(targets);
}

describe("./http conditions", () => {
  let root: string;
  let pkg: string;
  let server: ViteDevServer;

  beforeAll(async () => {
    const manifest = readFileSync(MANIFEST, "utf8");

    root = mkdtempSync(join(tmpdir(), "rpc-exports-"));
    pkg = join(root, "node_modules/@expressive/rpc");

    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "package.json"), manifest);

    for (const target of targets(JSON.parse(manifest).exports)) {
      mkdirSync(dirname(join(pkg, target)), { recursive: true });
      writeFileSync(join(pkg, target), "export {};");
    }

    server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
      environments: {
        workerd: { consumer: "server", resolve: { conditions: ["workerd", "worker", "browser", "module"], noExternal: true } },
      },
    });
  });

  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  const viaVite = async (environment: string) => {
    const resolved = await server.environments[environment].pluginContainer.resolveId("@expressive/rpc/http", join(root, "index.js"));
    return relative(pkg, resolved!.id);
  };

  it("will give node the server build", () => {
    const resolved = createRequire(join(root, "index.js")).resolve("@expressive/rpc/http");

    expect(relative(pkg, resolved)).toBe("dist/http.server.js");
  });

  it("will give a browser bundle the client build", async () => {
    expect(await viaVite("client")).toBe("dist/http.client.js");
  });

  it("will give a server bundle the server build", async () => {
    expect(await viaVite("ssr")).toBe("dist/http.server.js");
  });

  it("will give workerd the server build, though it resolves browser too", async () => {
    expect(await viaVite("workerd")).toBe("dist/http.server.js");
  });
});
