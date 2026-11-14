import { createHash } from "node:crypto";
import { dirname, relative, sep } from "node:path";

import type { Exports } from "../call";
import type { ErrorClass, Parent } from "./scan";
import type { Leaf, Tree } from "./surface";

export const SCRIPT = /\.[cm]?[jt]sx?$/;

export interface Located {
  file: string;
  pattern: string[];
  module: string;
}

export interface Exposed extends Located {
  calls: string[];
  errors: ErrorClass[];
}

export type Locate = (file: string) => Located | undefined;

export interface Stub {
  from?: string;
  at?: unknown;
  imports?: string[];
  lines?: string[];
}

export function locate(dir: string, file: string): Located | undefined {
  if (!file.startsWith(dir + sep) || !SCRIPT.test(file)) return;

  const pattern = relative(dir, file).split(sep);
  const name = pattern.pop()!.replace(SCRIPT, "");
  const dynamic = pattern.find(part => /^\[.*\]$/.test(part));

  if (dynamic) throw new Error(`${relative(dirname(dir), file)} is under ${dynamic} - folders are static path segments.`);

  return { file, pattern, module: name === "index" ? "" : name };
}

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

  /** The calls as a module: `handle(request)` answers a call and gives anything else `undefined`. */
  calls(gates: Located[]): string {
    const json = JSON.stringify;
    const files = [...new Set([...this.modules.keys(), ...gates.map(gate => gate.file)])];
    const alias = (file: string) => `m${files.indexOf(file)}`;

    const endpoints = this.byPattern().map((group, i) => {
      return [
        `const e${i} = { ${this.table(group, alias)} };`,
        `verify(${json(pathOf(group[0]))}, e${i});`,
      ];
    });

    return [
      `import { install, verify } from "@expressive/rpc/protocol";`,
      `import { handler } from "@expressive/rpc/http";`,
      ...files.map(file => `import * as ${alias(file)} from ${json(file)};`),
      "",
      "install();",
      "",
      ...endpoints.flat(),
      `const gates = new Map([${gates.map(gate => `[${json(gate.pattern.join("/"))}, ${alias(gate.file)}.default]`).join(", ")}]);`,
      `export const handle = handler([${this.byPattern().map((group, i) => `{ pattern: ${json(group[0].pattern)}, exports: async () => e${i} }`).join(", ")}], { seats: async pattern => gates.get(pattern.join("/")) });`,
      "",
    ].join("\n");
  }

  private seal(id: string): string {
    return this.salt ? createHash("sha256").update(this.salt + id).digest("base64url").slice(0, 16) : id;
  }
}

function importOf(from: string, file: string): string {
  const rel = relative(dirname(from), file).replaceAll("\\", "/");
  return rel.startsWith(".") ? rel : "./" + rel;
}

export function groupLines(file: string, tree: Tree): string[] {
  const json = JSON.stringify;
  const imports = new Map<string, Map<string, string>>();
  const groups: string[] = [];
  let count = 0;

  const render = (node: Tree | Leaf): string => {
    if (node instanceof Map) return node.size ? `{ ${[...node].map(([key, child]) => `${json(key)}: ${render(child)}`).join(", ")} }` : "{}";

    const names = imports.get(node.file) ?? imports.set(node.file, new Map()).get(node.file)!;
    return names.get(node.name) ?? names.set(node.name, `t${count++}`).get(node.name)!;
  };

  const exports = [...tree].map(([key, entry]) => {
    if (!(entry instanceof Map)) return `${render(entry)} as ${json(key)}`;

    groups.push(`const g${groups.length} = ${render(entry)};`);
    return `g${groups.length - 1} as ${json(key)}`;
  });

  return [
    ...[...imports].map(([from, names]) => `import { ${[...names].map(([name, alias]) => `${name} as ${alias}`).join(", ")} } from ${json(importOf(file, from))};`),
    ...groups,
    `export { ${exports.join(", ")} };`,
  ];
}
