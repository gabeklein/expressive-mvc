import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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

describe("./http types", () => {
  const SRC = fileURLToPath(new URL(".", import.meta.url));
  const MVC = fileURLToPath(new URL("../../mvc/src/index.ts", import.meta.url));

  it("will typecheck in a browser project without Node's types", () => {
    const emitted = new Map<string, string>();
    const options = { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, paths: { "@expressive/mvc": [MVC], "@expressive/mvc/*": [join(dirname(MVC), "*")] } };

    ts.createProgram([join(SRC, "http.ts")], { ...options, types: ["node"], declaration: true, emitDeclarationOnly: true, outDir: "/decl", rootDir: SRC }).emit(undefined, (file, text) => emitted.set(file, text));

    const fixture = "/app/main.ts";
    const files = new Map([...emitted, [fixture, `import { configure, NotFound, toNode } from "../decl/http";\nconfigure({ base: "https://api.example.com" });\nexport const node = toNode;\nexport const err: Error = new NotFound("x");\n`]]);
    const host = ts.createCompilerHost({});
    const program = ts.createProgram([fixture], { ...options, types: [], lib: ["lib.es2023.d.ts", "lib.dom.d.ts"], noEmit: true }, {
      ...host,
      fileExists: file => files.has(file) || host.fileExists(file),
      directoryExists: dir => [...files.keys()].some(file => file.startsWith(dir + "/")) || ts.sys.directoryExists(dir),
      readFile: file => files.get(file) ?? host.readFile(file),
      getSourceFile: (file, version) => files.has(file) ? ts.createSourceFile(file, files.get(file)!, version) : host.getSourceFile(file, version),
    });
    const ours = [...files.keys()].flatMap(file => [...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file))]);

    expect([...emitted.keys()]).toContain("/decl/http/node.d.ts");
    expect(ours.map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, "\n"))).toEqual([]);
  }, 30_000);
});
