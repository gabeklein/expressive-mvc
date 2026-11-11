import { createHash } from "node:crypto";
import { basename, dirname, extname, relative, sep } from "node:path";

import type { Exports } from "../call";
import { rank as rankOf } from "../segments";
import type { ErrorClass, Parent } from "./scan";

export const SCRIPT = /\.[cm]?[jt]sx?$/;

export interface Located {
  file: string;
  /** The folders down to the module, as the URL meets them: a name, `:name` for `[name]`, `*` for `[...]`. */
  pattern: string[];
  module: string;
  /** The module's own segment, as `pattern`'s are - none for `index` or `(index)`, which answer at their folder's path. */
  leaf?: string;
}

export interface Exposed extends Located {
  calls: string[];
  errors: ErrorClass[];
}

/** A module answering requests by method - `GET`, `POST`... */
export interface Route extends Located {
  methods: string[];
}

export type Locate = (file: string) => Located | undefined;

export interface Stub {
  from?: string;
  at?: unknown;
  imports?: string[];
  lines?: string[];
}

/**
 * A file or folder name as a path segment, shared with `@expressive/dev`'s pages: `[name]` takes
 * one segment as the param `name`, `[...]` the rest of the path, `(name)` is `name` taken literally.
 */
export function segmentOf(raw: string): string {
  if (raw === "[...]") return "*";

  const param = /^\[([A-Za-z_$][\w$]*)\]$/.exec(raw);
  if (param) return ":" + param[1];

  if (/^\[.*\]$/.test(raw)) throw new Error(`${raw} is not a segment - a param is [name], and [...] takes the rest of the path.`);

  return /^\((.+)\)$/.exec(raw)?.[1] ?? raw;
}

export const isDynamic = (part: string) => part === "*" || part.startsWith(":");

export function locate(dir: string, file: string): Located | undefined {
  if (!file.startsWith(dir + sep) || !SCRIPT.test(file)) return;

  const parts = relative(dir, file).split(sep);
  const name = parts.pop()!.replace(SCRIPT, "");
  const named = (problem: string) => new Error(`${relative(dirname(dir), file)}: ${problem}`);
  let pattern: string[];
  let leaf: string | undefined;

  try {
    pattern = parts.map(segmentOf);
    leaf = name === "index" || name === "(index)" ? undefined : segmentOf(name);
  } catch (error) {
    throw named((error as Error).message);
  }

  if (pattern.includes("*")) throw named("[...] takes the rest of the path - nothing is under it, so it is a file: [...].ts.");

  return { file, pattern, module: name === "index" ? "" : name, ...(leaf !== undefined && { leaf }) };
}

/** Whether a module's name makes it an address - `[name]`, `[...]` or `(name)` - so it may answer requests by method. */
export const isAddress = ({ module }: Located) => /^[[(]/.test(module);

export const pathOf = ({ pattern }: Located) => "/" + pattern.join("/");

const localId = ({ module }: Located, name: string) => (module ? `${module}:${name}` : name);
const globalId = (at: Located, name: string) => `${pathOf(at)}#${localId(at, name)}`;

export class Manifest<E extends Exposed = Exposed> {
  readonly modules = new Map<string, E>();

  constructor(readonly salt?: string) {}

  callId(at: Located, name: string): string {
    return this.salt ? this.seal(globalId(at, name)) : localId(at, name);
  }

  classId(at: Located, name: string): string {
    return this.seal(globalId(at, name));
  }

  parentId(parent: Parent, locate: Locate): string {
    return "id" in parent ? parent.id : this.classId(locate(parent.file)!, parent.name);
  }

  byPattern(): E[][] {
    const groups = new Map<string, E[]>();

    for (const exposed of this.modules.values()) {
      const key = pathOf(exposed);
      groups.set(key, [...(groups.get(key) ?? []), exposed]);
    }

    return [...groups.values()];
  }

  stub(exposed: E, locate: Locate, { from = "@expressive/rpc", at = pathOf(exposed), imports = [], lines = [] }: Stub = {}): string {
    const json = JSON.stringify;
    const before = new Set<string>();

    for (const { parent } of exposed.errors)
      if (parent && "file" in parent && parent.file !== exposed.file) before.add(importOf(exposed.file, parent.file));

    return [
      `import { ${["call", "define", ...imports].join(", ")} } from ${json(from)};`,
      ...[...before].map(spec => `import ${json(spec)};`),
      `const at = ${json(at)};`,
      ...exposed.calls.map(name => `export const ${name} = (...args) => call(at, ${json(this.callId(exposed, name))}, args);`),
      ...exposed.errors.map(({ name, parent }) => {
        const args = [json(this.classId(exposed, name)), json(name), ...(parent ? [json(this.parentId(parent, locate))] : [])];
        return `export const ${name} = define(${args.join(", ")});`;
      }),
      ...lines,
      "",
    ].join("\n");
  }

  table(group: E[], alias: (file: string) => string): string {
    const pick = (names: (exposed: E) => string[], id: (exposed: E, name: string) => string) =>
      group.flatMap(exposed => names(exposed).map(name => `${JSON.stringify(id(exposed, name))}: ${alias(exposed.file)}.${name}`)).join(", ");

    const calls = pick(exposed => exposed.calls, (exposed, name) => this.callId(exposed, name));
    const classes = pick(exposed => exposed.errors.map(error => error.name), (exposed, name) => this.classId(exposed, name));

    return `calls: { ${calls} }, classes: { ${classes} }`;
  }

  async exports(group: E[], load: (file: string) => Promise<Record<string, unknown>>, check: (file: string, exports: Exports) => void): Promise<Exports> {
    const calls: Record<string, unknown> = {};
    const classes: Record<string, unknown> = {};

    for (const exposed of group) {
      const mod = await load(exposed.file);
      const own: Record<string, unknown> = {};

      for (const name of exposed.calls) calls[this.callId(exposed, name)] = mod[name];
      for (const { name } of exposed.errors) own[this.classId(exposed, name)] = mod[name];

      check(exposed.file, { calls, classes: own });
      Object.assign(classes, own);
    }

    return { calls, classes };
  }

  /** The tree of folders along `gates`, the call groups and `routes`, each slot filled by `value`. */
  branches<T>(gates: Located[], routes: Route[], value: Values<E, T>): Branch<T> {
    const root: Branch<T> = { children: {} };
    const owners = new Map<Branch<T>, Map<Slot, string>>();

    const fill = (pattern: string[], slot: Slot, file: string, item: T) => {
      let node = root;

      for (const [i, part] of pattern.entries()) {
        const sibling = isDynamic(part) && Object.keys(node.children).find(key => key !== part && rankOf(key) === rankOf(part));

        if (sibling) throw new Error(`${pathOf({ pattern: pattern.slice(0, i + 1) } as Located)} is taken by ${sibling} too - a folder's params need one name.`);

        node = node.children[part] ??= { children: {} };
      }

      owners.set(node, (owners.get(node) ?? new Map<Slot, string>()).set(slot, file));
      node[slot] = item;
    };

    this.byPattern().forEach((group, i) => fill(group[0].pattern, "calls", group[0].file, value.calls(group, i)));
    for (const gate of gates) fill(gate.pattern, "gate", gate.file, value.gate(gate));
    for (const route of routes) {
      if (route.leaf === undefined) fill(route.pattern, "index", route.file, value.route(route));
      else fill([...route.pattern, route.leaf], "file", route.file, value.route(route));
    }

    owned(root, owners);

    return root;
  }

  /**
   * The server as a module: `handle(request)` answers a call or a route of the tree - folders, their
   * gates, calls and route modules - and gives anything else `undefined`.
   */
  tree(gates: Located[], routes: Route[], { base = "" }: { base?: string } = {}): string {
    const json = JSON.stringify;
    const files = [...new Set([...this.modules.keys(), ...gates.map(gate => gate.file), ...routes.map(route => route.file)])];
    const alias = (file: string) => `m${files.indexOf(file)}`;
    const groups = this.byPattern();
    const tree = this.branches<string>(gates, routes, {
      calls: (_, i) => `async () => e${i}`,
      gate: gate => `async () => ${alias(gate.file)}.default`,
      route: route => `async () => ${alias(route.file)}`,
    });

    const literal = ({ children, ...slots }: Branch<string>): string => {
      const fields = Object.entries(slots).map(([slot, item]) => `${slot}: ${item}`);
      const nested = Object.entries(children).map(([key, child]) => `${json(key)}: ${literal(child)}`);

      return `{ ${[...fields, ...(nested.length ? [`children: { ${nested.join(", ")} }`] : [])].join(", ")} }`;
    };

    return [
      `import { install, verify } from "@expressive/rpc/protocol";`,
      `import { router } from "@expressive/rpc/http";`,
      ...files.map(file => `import * as ${alias(file)} from ${json(file)};`),
      "",
      "install();",
      "",
      ...groups.flatMap((group, i) => [`const e${i} = { ${this.table(group, alias)} };`, `verify(${json(pathOf(group[0]))}, e${i});`]),
      `export const handle = router(${literal(tree)}${base ? `, { base: ${json(base)} }` : ""});`,
      "",
    ].join("\n");
  }

  private seal(id: string): string {
    return this.salt ? createHash("sha256").update(this.salt + id).digest("base64url").slice(0, 16) : id;
  }
}

type Slot = "gate" | "calls" | "index" | "file";

/** One folder of the tree, its slots holding whatever the builder made of each module. */
export type Branch<T> = { [slot in Slot]?: T } & { children: Record<string, Branch<T>> };

export interface Values<E, T> {
  calls(group: E[], index: number): T;
  gate(gate: Located): T;
  route(route: Route): T;
}

/** Throw for a route module beside a folder of its name - each URL has one owner, behind the gates of the folders on its path. */
function owned<T>(node: Branch<T>, owners: Map<Branch<T>, Map<Slot, string>>, pattern: string[] = []): void {
  const slots = owners.get(node);
  const file = slots?.get("file");
  const other = [...(slots?.entries() ?? [])].find(([slot]) => slot !== "file")?.[1] ?? Object.keys(node.children).length;

  if (file && other) {
    const folder = basename(file).replace(SCRIPT, "").replace(/^\((.+)\)$/, "$1");
    throw new Error(`${file} answers ${pathOf({ pattern } as Located)}, which its folder answers for too - move it into the folder, as ${folder}/(index)${extname(file)}.`);
  }

  for (const [key, child] of Object.entries(node.children)) owned(child, owners, [...pattern, key]);
}

function importOf(from: string, file: string): string {
  const rel = relative(dirname(from), file).replaceAll("\\", "/");
  return rel.startsWith(".") ? rel : "./" + rel;
}
