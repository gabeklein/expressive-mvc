import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { initSync, parse } from "es-module-lexer";
import { build } from "tsdown";
import ts from "typescript";
import { createServer, type ViteDevServer } from "vite";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const MANIFEST = join(PACKAGE, "package.json");

function targets(node: unknown): string[] {
  if (typeof node == "string") return [node];

  return Object.values(node as object).flatMap(targets);
}

describe("conditions", () => {
  let root: string;
  let pkg: string;
  let server: ViteDevServer;

  beforeAll(async () => {
    const manifest = readFileSync(MANIFEST, "utf8");

    // Real path: macOS hands out /var/... and resolvers report /private/var/....
    root = realpathSync(mkdtempSync(join(tmpdir(), "rpc-exports-")));
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
    const resolved = await server.environments[environment].pluginContainer.resolveId("@expressive/rpc", join(root, "index.js"));
    return relative(pkg, resolved!.id);
  };

  it("will give node the server build", () => {
    const resolved = createRequire(join(root, "index.js")).resolve("@expressive/rpc");

    expect(relative(pkg, resolved)).toBe("dist/index.server.js");
  });

  it("will give a browser bundle the client build", async () => {
    expect(await viaVite("client")).toBe("dist/index.client.js");
  });

  it("will give a server bundle the server build", async () => {
    expect(await viaVite("ssr")).toBe("dist/index.server.js");
  });

  it("will give workerd the server build, though it resolves browser too", async () => {
    expect(await viaVite("workerd")).toBe("dist/index.server.js");
  });
});

describe("types", () => {
  const SRC = fileURLToPath(new URL(".", import.meta.url));
  const MVC = fileURLToPath(new URL("../../mvc/src/index.ts", import.meta.url));

  it("will typecheck in a browser project without Node's types", () => {
    const emitted = new Map<string, string>();
    const options = { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, paths: { "@expressive/mvc": [MVC], "@expressive/mvc/*": [join(dirname(MVC), "*")] } };

    ts.createProgram([join(SRC, "index.ts"), join(SRC, "http.ts")], { ...options, types: ["node"], declaration: true, emitDeclarationOnly: true, outDir: "/decl", rootDir: SRC }).emit(undefined, (file, text) => emitted.set(file, text));

    const fixture = "/app/main.ts";
    const files = new Map([...emitted, [fixture, `import { configure, Current, NotFound } from "../decl/index";\nimport { handler, toNode } from "../decl/http";\nconfigure({ base: "https://api.example.com" });\nexport const node = toNode(handler([]));\nexport const current = Current;\nexport const err: Error = new NotFound("x");\n`]]);
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

describe("build", () => {
  let dist: string;
  let exported: string[];

  const emitted = () => readdirSync(dist, { recursive: true, encoding: "utf8" }).filter(file => /\.(js|d\.ts)$/.test(file));

  const importsOf = (file: string) =>
    existsSync(join(dist, file)) ? [...readFileSync(join(dist, file), "utf8").matchAll(/(?:from|import)\s*"([^"]+)"/g)].map(([, spec]) => spec) : [];

  const target = (file: string, spec: string) => join(dirname(file), file.endsWith(".d.ts") ? spec.replace(/\.js$/, ".d.ts") : spec);

  const reach = (entries: string[]) => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);

      for (const spec of importsOf(file)) if (spec.startsWith(".")) visit(target(file, spec));
    };

    entries.forEach(visit);
    return seen;
  };

  beforeAll(async () => {
    dist = mkdtempSync(join(tmpdir(), "rpc-dist-"));
    exported = targets(JSON.parse(readFileSync(MANIFEST, "utf8")).exports).map(target => relative("./dist", target));

    await build({ config: join(PACKAGE, "tsdown.config.ts"), cwd: PACKAGE, outDir: dist, logLevel: "silent" });
  }, 60_000);

  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it("will emit every file the exports map names", () => {
    expect(exported.filter(file => !existsSync(join(dist, file)))).toEqual([]);
  });

  it("will emit no entry file the exports map cannot reach", () => {
    const reached = reach(exported);
    const entries = emitted().filter(file => !file.startsWith("chunk-"));

    expect(entries.filter(file => !reached.has(file))).toEqual([]);
  });

  it("will resolve every relative import to an emitted file", () => {
    const missing = emitted().flatMap(file => importsOf(file).filter(spec => spec.startsWith(".")).map(spec => target(file, spec))).filter(file => !existsSync(join(dist, file)));

    expect(missing).toEqual([]);
  });

  it("will give the server build every name the browser build has, Current and Cookies", () => {
    initSync();

    const names = (file: string) => parse(readFileSync(join(dist, file), "utf8"))[1].map(({ n }) => n).sort();

    expect(names("index.client.js")).toEqual(expect.arrayContaining(["HttpError", "call", "client", "configure", "define"]));
    expect(names("index.server.js")).toEqual([...names("index.client.js"), "Cookies", "Current"].sort());
  });

  it("will keep node out of the browser build", () => {
    const reached = [...reach(["index.client.js"])];
    expect(reached.filter(file => /class Current\b/.test(readFileSync(join(dist, file), "utf8")))).toEqual([]);

    expect(reached.flatMap(importsOf).filter(spec => !spec.startsWith("."))).toEqual([]);
    expect(reached.filter(file => /AsyncLocalStorage/.test(readFileSync(join(dist, file), "utf8")))).toEqual([]);
  });

  it("will keep vite and its parsers out of every runtime entry", () => {
    const runtime = ["index.server.js", "index.client.js", "http.js", "protocol.js"];
    const external = [...reach(runtime)].flatMap(importsOf).filter(spec => !spec.startsWith("."));

    expect([...new Set(external)].sort()).toEqual(["@expressive/mvc", "@expressive/mvc/jsx-runtime", "node:async_hooks", "node:crypto"]);
  });
});
