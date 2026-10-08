import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { relImport } from "./project";

const ROUTE_EXT = new Set([".tsx", ".jsx", ".ts", ".js"]);

const ROLES = [
  "Page",
  "Layout",
  "Loading",
  "Catch",
  "NotFound",
] as const;

type Role = (typeof ROLES)[number];

const LAZY = new Set<Role>(["Page", "Layout", "NotFound"]);

export type ExportScanner = (source: string, path: string) => Iterable<string> | Promise<Iterable<string>>;

interface RouteNode {
  segment: string;
  name: string;
  file?: string;
  exports: Set<string>;
  children: RouteNode[];
  isLeaf: boolean;
  alias: Partial<Record<Role, string>>;
}

export async function generateRoutes(appDir: string, outDir: string, scan: ExportScanner): Promise<string> {
  const root = await scanDir(appDir, "", "", scan);

  assignAliases(root, new Set());

  const { imports, loaders } = collectImports(root, outDir);
  const tree = emitNode(root, true, 2).join("\n");
  const pageImports = root.exports.has("NotFound") ? "{ Route, Router }" : "{ NotFound, Route, Router }";

  return [
    `import ${pageImports} from "@expressive/dev";`,
    "",
    ...imports,
    ...(loaders.length ? ["", ...loaders] : []),
    "",
    "const App = () => (\n  <Router>", tree, "  </Router>\n);\n",
    "export default App;\n",
  ].join("\n");
}

function newNode(fields: Partial<RouteNode>): RouteNode {
  return { segment: "", name: "", exports: new Set(), children: [], isLeaf: false, alias: {}, ...fields };
}

async function scanDir(dir: string, segment: string, name: string, scan: ExportScanner): Promise<RouteNode> {
  const node = newNode({ segment, name });

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      const tag = classify(entry, true)!;
      node.children.push(await scanDir(full, tag.segment, name + tag.label, scan));
      continue;
    }

    const ext = extname(entry);
    if (!ROUTE_EXT.has(ext)) continue;

    const tag = classify(basename(entry, ext), false);
    if (!tag) continue;

    const exports = new Set(await scan(readFileSync(full, "utf8"), full));

    if (tag.kind === "index") {
      node.file = full;
      node.exports = exports;
      continue;
    }

    node.children.push(newNode({
      segment: tag.segment,
      name: name + tag.label,
      file: full,
      exports,
      isLeaf: true,
    }));
  }

  return node;
}

interface Tag {
  kind: "index" | "static" | "param" | "splat";
  segment: string;
  label: string;
}

export function classify(raw: string, bareIsRoute: boolean): Tag | null {
  if (raw === "index") return { kind: "index", segment: "", label: "" };

  const paren = /^\((.+)\)$/.exec(raw);
  if (paren)
    return { kind: "static", segment: paren[1], label: pascal(paren[1]) };

  if (raw === "[...]")
    return { kind: "splat", segment: "*", label: "Catchall" };

  const square = /^\[(.+)\]$/.exec(raw);
  if (square)
    return {
      kind: "param",
      segment: ":" + square[1],
      label: pascal(square[1]),
    };

  return bareIsRoute ? { kind: "static", segment: raw, label: pascal(raw) } : null;
}

function assignAliases(node: RouteNode, used: Set<string>): void {
  const base = node.name || "Root";

  for (const role of ROLES) {
    if (!node.exports.has(role)) continue;

    let alias = role === "Page" ? base : base + role;
    while (used.has(alias)) alias += "_";

    used.add(alias);
    node.alias[role] = alias;
  }

  for (const child of node.children) assignAliases(child, used);
}

function collectImports(root: RouteNode, outDir: string) {
  const imports: string[] = [];
  const loaders: string[] = [];

  (function walk(node: RouteNode) {
    const roles = ROLES.filter(role => node.alias[role]);
    const spec = node.file && JSON.stringify(relImport(outDir, node.file));

    if (spec && node !== root && roles.every(role => LAZY.has(role)))
      for (const role of roles)
        loaders.push(`const ${node.alias[role]} = () => import(${spec}).then(m => m.${role});`);
    else if (spec && roles.length)
      imports.push(`import { ${roles.map(role => `${role} as ${node.alias[role]}`).join(", ")} } from ${spec};`);

    node.children.forEach(walk);
  })(root);

  return { imports, loaders };
}

function emitNode(node: RouteNode, isRoot: boolean, depth: number): string[] {
  const pad = "  ".repeat(depth);
  const { Page, Layout, Loading, Catch, NotFound } = node.alias;

  const fallback = Loading && `<${Loading} />`;
  const isScope = isRoot || node.children.length > 0 || !!Layout || !!NotFound;

  if (!isScope)
    return Page ? route(pad, { to: node.segment, as: Page, fallback, Catch }) : [];

  const inner: string[] = [];

  if (Page) inner.push(...route(pad + "  ", { as: Page }));

  for (const child of node.children)
    inner.push(...emitNode(child, false, depth + 1));

  if (!inner.length) return [];

  const fallbackPage = NotFound ?? (isRoot ? "NotFound" : undefined);
  return route(
    pad,
    { to: isRoot ? undefined : node.segment, as: Layout, NotFound: fallbackPage, fallback, Catch },
    inner,
  );
}

interface RouteProps {
  to?: string;
  as?: string;
  NotFound?: string;
  fallback?: string;
  Catch?: string;
}

function route(pad: string, attrs: RouteProps, children?: string[]): string[] {
  const props = Object.entries(attrs).map(([k, v]) => {
    if (!v) return "";
    return k === "to" ? ` ${k}="${v}"` : ` ${k}={${v}}`;
  }).join("");

  const head = `${pad}<Route${props}`;

  return children
    ? [`${head}>`, ...children, `${pad}</Route>`]
    : [`${head} />`];
}

function pascal(s: string): string {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join("");
}
