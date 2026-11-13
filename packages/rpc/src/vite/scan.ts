import { basename } from "node:path";
import { parseSync, type ESTree } from "vite";

import { ERRORS } from "../errors";

export interface Sources {
  resolve(spec: string, importer: string): Promise<string | undefined>;
  read(file: string): string;
}

export type Parent = { id: string } | { file: string; name: string };

export interface ErrorClass {
  name: string;
  parent?: Parent;
}

export interface Scan {
  calls: string[];
  errors: ErrorClass[];
  gate: boolean;
  problems: string[];
}

export interface Extension {
  claim?(name: string): Promise<string[] | undefined>;
  default?(value: Value): Promise<string[]>;
}

export type Value = ESTree.Node | null | undefined;
type Statement = ESTree.Program["body"][number];

export interface Module {
  file: string;
  body: Statement[];
  locals: Map<string, Value>;
  imports: Map<string, Import>;
  exports: Map<string, Value>;
  errors: string[];
}

interface Import {
  from: string;
  name: string;
  type: boolean;
}

interface Found {
  cls: ESTree.Class;
  module: Module;
}

type End = { kind: "error"; parent?: Parent } | { kind: "model" | "plain" } | { kind: "problem"; problem: string };

const ROOT = "@expressive/rpc";
const LIBRARY = /^@expressive\//;
const INDEX = /^index\.[cm]?[jt]sx?$/;

const isFunction = (value: Value): value is ESTree.Function | ESTree.ArrowFunctionExpression =>
  value?.type === "FunctionDeclaration" || value?.type === "FunctionExpression" || value?.type === "ArrowFunctionExpression";

export const isClass = (value: Value): value is ESTree.Class =>
  value?.type === "ClassDeclaration" || value?.type === "ClassExpression";

export const nameOf = (node: ESTree.ModuleExportName) => (node.type === "Identifier" ? node.name : String(node.value));

/**
 * What a module under the folder gives the client. With `only` - a trunk's leaves from this module - the rest of
 * its exports stay on the server unchecked, save Error classes, which still cross.
 */
export async function scanModule(file: string, source: string, sources: Sources, owned: (file: string) => boolean, extension: Extension = {}, only?: ReadonlySet<string>): Promise<Scan> {
  const module = moduleOf(file, source);
  const scan: Scan = { calls: [], errors: [], gate: false, problems: [...module.errors] };
  const found: [ErrorClass, number][] = [];

  for (const node of only ? [] : module.body) {
    const problem = unsupported(node);
    if (problem) scan.problems.push(problem);
  }

  for (const [name, value] of module.exports) {
    if (name === "default") {
      if (extension.default) scan.problems.push(...(await extension.default(value)));
      else if (!only || INDEX.test(basename(file))) await gate(scan, value, module, sources, owned);
      continue;
    }

    if (only && !only.has(name)) {
      const end = isClass(value) ? await endOf({ cls: value, module }, name, sources, owned) : undefined;

      if (end?.kind === "error") found.push([{ name, ...(end.parent && { parent: end.parent }) }, value!.start]);
      continue;
    }

    if (!isFunction(value) && !isClass(value)) {
      scan.problems.push(`${name} is neither an async function nor an Error subclass - the client could not use it.`);
      continue;
    }

    if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
      scan.problems.push(`"${name}" is not an identifier - the client stub could not export it.`);
      continue;
    }

    if (isFunction(value)) {
      if (value.async) scan.calls.push(name);
      else scan.problems.push(`${name}() is not async - every call to it crosses the wire.`);
      continue;
    }

    const claimed = await extension.claim?.(name);

    if (claimed) {
      scan.problems.push(...claimed);
      continue;
    }

    const end = await endOf({ cls: value, module }, name, sources, owned);

    if (end.kind === "error") found.push([{ name, ...(end.parent && { parent: end.parent }) }, value.start]);
    else if (end.kind === "problem") scan.problems.push(end.problem);
    else if (end.kind === "plain") scan.problems.push(`${name} is a class but not an Error - only error classes reach the client.`);
    else scan.problems.push(`${name} is a class but not an Error - only error classes reach the client; a Model it constructs is a twin, which needs @expressive/dev.`);
  }

  scan.errors = found.sort((a, b) => a[1] - b[1]).map(([error]) => error);

  return scan;
}

async function gate(scan: Scan, value: Value, module: Module, sources: Sources, owned: (file: string) => boolean): Promise<void> {
  if (!INDEX.test(basename(module.file)))
    return void scan.problems.push("Only a folder's index may export a default - its gate.");

  if (isFunction(value)) return void (scan.gate = true);

  const end = isClass(value) ? await endOf({ cls: value, module }, "default", sources, owned) : undefined;

  if (end?.kind === "problem") scan.problems.push(end.problem);
  else if (end?.kind === "model") scan.gate = true;
  else scan.problems.push("An index's default is its folder's gate - a function run before each call, or a Model subclass whose static key() admits each call.");
}

function unsupported(node: Statement): string | undefined {
  if (node.type === "ExportAllDeclaration" || (node.type === "ExportNamedDeclaration" && node.source))
    return "A server module cannot re-export from another module.";

  if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type" || !node.declaration) return;

  switch (node.declaration.type) {
    case "FunctionDeclaration":
    case "ClassDeclaration":
    case "VariableDeclaration":
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
      return;
    default:
      return "A server module exports async functions and Error subclasses only.";
  }
}

async function endOf(start: Found, name: string, sources: Sources, owned: (file: string) => boolean): Promise<End> {
  const chain: Found[] = [];
  const names: string[] = [];
  let parent: Parent | undefined;
  let at = start;

  for (;;) {
    const { cls, module } = at;
    const base = cls.superClass;
    const owner = cls.id?.name ?? "default";
    const loop = chain.findIndex(found => found.module.file === module.file && found.cls.start === cls.start);

    if (loop >= 0) return { kind: "problem", problem: cycle(names.slice(loop)) };
    chain.push(at);
    names.push(name);

    if (!base) return { kind: "plain" };
    if (base.type !== "Identifier") return { kind: "problem", problem: `${owner} extends an expression - name its base class.` };

    const local = module.locals.get(base.name);
    const imported = module.imports.get(base.name);
    let next: Found;

    if (isClass(local)) next = { cls: local, module };
    else if (!imported || imported.type) return globalEnd(owner, base.name, parent);
    else if (imported.from === ROOT && `http:${imported.name}` in ERRORS) return { kind: "error", parent: parent ?? { id: `http:${imported.name}` } };
    else if (LIBRARY.test(imported.from)) return { kind: "model" };
    else if (!/^[./]/.test(imported.from)) return { kind: "error", parent };
    else {
      const file = await sources.resolve(imported.from, module.file);

      if (!file) return { kind: "problem", problem: `${owner} extends ${base.name} from "${imported.from}", which does not resolve.` };

      const other = moduleOf(file, sources.read(file));
      const exported = other.exports.get(imported.name);

      if (!isClass(exported)) return { kind: "problem", problem: `${owner} extends ${base.name}, which "${imported.from}" does not export as a class.` };

      next = { cls: exported, module: other };
    }

    parent ??= parentOf(next, owned);
    name = base.name;
    at = next;
  }
}

function cycle([first, ...rest]: string[]): string {
  return `${first} extends ${[...rest, first].join(", which extends ")} - a class cannot extend itself.`;
}

function globalEnd(owner: string, name: string, parent?: Parent): End {
  const Global = (globalThis as Record<string, unknown>)[name];

  if (typeof Global != "function") return { kind: "problem", problem: `${owner} extends ${name}, which is neither declared nor imported.` };

  return Global === Error || Global.prototype instanceof Error ? { kind: "error", parent } : { kind: "plain" };
}

function parentOf({ cls, module }: Found, owned: (file: string) => boolean): Parent | undefined {
  const name = [...module.exports].find(([name, value]) => value === cls && name !== "default")?.[0];

  if (name && owned(module.file)) return { file: module.file, name };
}

export function moduleOf(file: string, source: string): Module {
  const { program, errors } = parseSync(file, source);
  const locals = new Map<string, Value>();
  const imports = new Map<string, Import>();
  const exports = new Map<string, Value>();

  for (const node of program.body) {
    const decl = node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration" ? node.declaration : node;

    if ((decl?.type === "FunctionDeclaration" || decl?.type === "ClassDeclaration") && decl.id) locals.set(decl.id.name, decl);

    if (decl?.type === "VariableDeclaration")
      for (const { id, init } of decl.declarations) if (id.type === "Identifier") locals.set(id.name, init);

    if (node.type === "ImportDeclaration")
      for (const spec of node.specifiers) {
        if (spec.type === "ImportNamespaceSpecifier") continue;

        const named = spec.type === "ImportSpecifier";
        const type = node.importKind === "type" || (named && spec.importKind === "type");

        imports.set(spec.local.name, { from: node.source.value, name: named ? nameOf(spec.imported) : "default", type });
      }
  }

  for (const node of program.body) for (const [name, value] of exportsOf(node, locals)) exports.set(name, value);

  return { file, body: program.body, locals, imports, exports, errors: errors.map(error => error.message) };
}

function exportsOf(node: Statement, locals: Map<string, Value>): [string, Value][] {
  if (node.type === "ExportDefaultDeclaration") {
    const { declaration } = node;
    return [["default", declaration.type === "Identifier" ? locals.get(declaration.name) : (declaration as Value)]];
  }

  if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type" || node.source) return [];

  const { declaration } = node;

  if (!declaration)
    return node.specifiers.filter(spec => spec.exportKind !== "type").map(spec => [nameOf(spec.exported), locals.get(nameOf(spec.local))]);

  switch (declaration.type) {
    case "FunctionDeclaration":
    case "ClassDeclaration":
      return [[declaration.id!.name, declaration]];
    case "VariableDeclaration":
      return declaration.declarations.map(({ id, init }) => [id.type === "Identifier" ? id.name : "A destructured export", init]);
    default:
      return [];
  }
}
