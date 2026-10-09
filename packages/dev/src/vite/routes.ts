import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, sep } from "node:path";

import { importRel } from "./project";

const ROUTE_EXT = new Set([".tsx", ".jsx", ".ts", ".js"]);

const ROLES = [
  "Page",
  "Layout",
  "Loading",
  "Catch",
  "NotFound",
  "default",
] as const;

type Role = (typeof ROLES)[number];

export interface Scan {
  exports: Iterable<string>;
  classDefault?: boolean;
}

export type ExportScanner = (source: string, path: string) => Scan | Promise<Scan>;

interface RouteNode {
  segment: string;
  name: string;
  file?: string;
  exports: Set<string>;
  classDefault: boolean;
  children: RouteNode[];
  isLeaf: boolean;
  alias: Partial<Record<Role, string>>;
}

export async function generateRoutes(appDir: string, outDir: string, scan: ExportScanner): Promise<string> {
  const root = await scanDir(appDir, "", "", scan);

  assignAliases(root, new Set());

  const { imports, loaders } = collectImports(root, outDir);
  const wrappers = collectWrappers(root);
  const tree = emitNode(root, true, 2, "null").join("\n");
  const pageImports = root.exports.has("NotFound") ? "{ Route, Router }" : "{ NotFound, Route, Router }";

  return [
    `import ${pageImports} from "@expressive/dev";`,
    "",
    ...imports,
    ...(loaders.length ? ["", ...loaders] : []),
    ...(wrappers.length ? ["", ...wrappers] : []),
    "",
    "const App = () => (\n  <Router>", tree, "  </Router>\n);\n",
    "export default App;\n",
  ].join("\n");
}

function newNode(fields: Partial<RouteNode>): RouteNode {
  return { segment: "", name: "", exports: new Set(), classDefault: false, children: [], isLeaf: false, alias: {}, ...fields };
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

    const scanned = await scan(readFileSync(full, "utf8"), full);
    const exports = new Set(scanned.exports);
    const classDefault = !!scanned.classDefault;

    if (tag.kind === "index") {
      node.file = full;
      node.exports = exports;
      node.classDefault = classDefault;
      continue;
    }

    node.children.push(newNode({
      segment: tag.segment,
      name: name + tag.label,
      file: full,
      exports,
      classDefault,
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

    const defaultSuffix = node.classDefault ? "Scope" : "Enter";
    const suffix = role === "default" ? defaultSuffix : role;
    let alias = role === "Page" ? base : base + suffix;
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

    if (node.file && roles.length) {
      const spec = JSON.stringify(importRel(outDir, node.file));
      const lazy = node !== root && !node.alias.Loading && !node.alias.Catch;

      if (lazy) loaders.push(...roles.map(role => loaderFor(node, role, spec)));
      else imports.push(importFor(node, roles, spec));
    }

    node.children.forEach(walk);
  })(root);

  return { imports, loaders };
}

function loaderFor(node: RouteNode, role: Role, spec: string): string {
  const load = role === "default" && !node.classDefault
    ? `route => import(${spec}).then(m => m.default(route))`
    : `() => import(${spec}).then(m => m.${role})`;

  return `const ${node.alias[role]} = ${load};`;
}

function importFor(node: RouteNode, roles: Role[], spec: string): string {
  const named = roles.filter(role => role !== "default").map(role => `${role} as ${node.alias[role]}`);
  const namedClause = named.length ? `{ ${named.join(", ")} }` : undefined;
  const clause = [node.alias.default, namedClause].filter(Boolean).join(", ");

  return `import ${clause} from ${spec};`;
}

const renders = (node: RouteNode): boolean => !!node.alias.Page || node.children.some(renders);

function wrapperOf(node: RouteNode): string | undefined {
  const { Layout, default: def } = node.alias;

  if (node.classDefault && def && Layout && renders(node)) return def + "d";
}

function collectWrappers(root: RouteNode): string[] {
  const wrappers: string[] = [];

  (function walk(node: RouteNode) {
    node.children.forEach(walk);

    const name = wrapperOf(node);
    const { Layout, default: scope } = node.alias;

    if (name) wrappers.push(`const ${name} = props => <${scope}><${Layout} {...props} /></${scope}>;`);
  })(root);

  return wrappers;
}

function emitNode(node: RouteNode, isRoot: boolean, depth: number, slot: string): string[] {
  const pad = "  ".repeat(depth);
  const { Page, Layout, Loading, Catch, NotFound, default: def } = node.alias;
  const enter = node.classDefault ? undefined : def;
  const scope = node.classDefault ? def : undefined;

  const own = Loading ? `<${Loading} />` : undefined;
  const isScope = isRoot || node.children.length > 0 || !!Layout || !!NotFound || !!scope;

  if (!isScope)
    return Page ? route(pad, { to: node.segment, as: Page, enter, fallback: own ?? slot, Catch }) : [];

  const inner: string[] = [];
  const childSlot = own ?? (Layout ? "null" : slot);

  if (Page) inner.push(...route(pad + "  ", { as: Page, fallback: childSlot }));

  for (const child of node.children)
    inner.push(...emitNode(child, false, depth + 1, childSlot));

  if (!inner.length) return [];

  const as = wrapperOf(node) ?? scope ?? Layout;
  const fallbackPage = NotFound ?? (isRoot ? "NotFound" : undefined);

  return route(
    pad,
    { to: isRoot ? undefined : node.segment, as, NotFound: fallbackPage, enter, fallback: slot, Catch },
    inner,
  );
}

interface RouteProps {
  to?: string;
  as?: string;
  NotFound?: string;
  enter?: string;
  fallback?: string;
  Catch?: string;
}

function route(pad: string, attrs: RouteProps, children?: string[]): string[] {
  const props = Object.entries(attrs)
    .filter(([, v]) => v)
    .map(([k, v]) => (k === "to" ? ` ${k}="${v}"` : ` ${k}={${v}}`))
    .join("");

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

const SIDECAR = /^api\.[cm]?[jt]s$/;

export interface Sidecar {
  pattern: string[];
  file: string;
}

export function sidecarPattern(appDir: string, file: string): string[] | undefined {
  if (!SIDECAR.test(basename(file)) || !file.startsWith(appDir + sep)) return;

  return relative(appDir, dirname(file)).split(sep).filter(Boolean).map(dir => classify(dir, true)!.segment);
}

export function sidecars(appDir: string): Sidecar[] {
  return readdirSync(appDir, { recursive: true, encoding: "utf8" }).flatMap(rel => {
    const file = join(appDir, rel);
    const pattern = sidecarPattern(appDir, file);
    return pattern ? [{ pattern, file }] : [];
  });
}
