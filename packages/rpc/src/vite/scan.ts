import { basename } from "node:path";
import { parseSync, type ESTree } from "vite";

import { ERRORS } from "../http/errors";

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

type Value = ESTree.Node | null | undefined;
type Statement = ESTree.Program["body"][number];

interface Module {
  file: string;
  body: Statement[];
  locals: Map<string, Value>;
  imports: Map<string, { from: string; name: string }>;
  exports: Map<string, Value>;
  errors: string[];
}

interface Found {
  cls: ESTree.Class;
  module: Module;
}

type End = { kind: "error"; parent?: Parent } | { kind: "model" | "plain" } | { kind: "problem"; problem: string };

const HTTP = "@expressive/rpc/http";
const LIBRARY = /^@expressive\//;
const INDEX = /^index\.[cm]?[jt]sx?$/;

const isFunction = (value: Value): value is ESTree.Function | ESTree.ArrowFunctionExpression =>
  value?.type === "FunctionDeclaration" || value?.type === "FunctionExpression" || value?.type === "ArrowFunctionExpression";

const isClass = (value: Value): value is ESTree.Class =>
  value?.type === "ClassDeclaration" || value?.type === "ClassExpression";

const nameOf = (node: ESTree.ModuleExportName) => (node.type === "Identifier" ? node.name : String(node.value));

export async function scanModule(file: string, source: string, sources: Sources, owned: (file: string) => boolean): Promise<Scan> {
  const module = moduleOf(file, source);
  const scan: Scan = { calls: [], errors: [], gate: false, problems: [...module.errors] };
  const found: [ErrorClass, number][] = [];

  for (const node of module.body) {
    const problem = unsupported(node);
    if (problem) scan.problems.push(problem);
  }

  for (const [name, value] of module.exports) {
    if (name === "default") {
      await gate(scan, value, module, sources, owned);
      continue;
    }

    if (isFunction(value)) {
      if (value.async) scan.calls.push(name);
      else scan.problems.push(`${name}() is not async - every call to it crosses the wire.`);
      continue;
    }

    if (!isClass(value)) {
      scan.problems.push(`${name} is neither an async function nor an Error class - the client could not use it.`);
      continue;
    }

    const end = await endOf({ cls: value, module }, sources, owned);

    if (end.kind === "error") found.push([{ name, ...(end.parent && { parent: end.parent }) }, value.start]);
    else if (end.kind === "problem") scan.problems.push(end.problem);
    else scan.problems.push(`${name} is a class but not an Error - only error classes reach the client; a Model it constructs is a twin, which needs @expressive/dev.`);
  }

  scan.errors = found.sort((a, b) => a[1] - b[1]).map(([error]) => error);

  return scan;
}

async function gate(scan: Scan, value: Value, module: Module, sources: Sources, owned: (file: string) => boolean): Promise<void> {
  if (!INDEX.test(basename(module.file)))
    return void scan.problems.push("Only a folder's index may export a default - its gate.");

  const end = isClass(value) ? await endOf({ cls: value, module }, sources, owned) : undefined;

  if (end?.kind === "problem") scan.problems.push(end.problem);
  else if (end?.kind === "model") scan.gate = true;
  else scan.problems.push("An index's default is its folder's gate - a Model subclass whose static key() admits each call.");
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
      return "A server module exports async functions and Error classes only.";
  }
}

async function endOf(start: Found, sources: Sources, owned: (file: string) => boolean): Promise<End> {
  const seen = new Set<ESTree.Class>();
  let parent: Parent | undefined;
  let at = start;

  for (;;) {
    const { cls, module } = at;
    const base = cls.superClass;
    const owner = cls.id?.name ?? "default";

    if (seen.has(cls)) return { kind: "problem", problem: `${owner} extends itself.` };
    seen.add(cls);

    if (!base) return { kind: "plain" };
    if (base.type !== "Identifier") return { kind: "problem", problem: `${owner} extends an expression - name its base class.` };

    const local = module.locals.get(base.name);
    const imported = module.imports.get(base.name);
    let next: Found;

    if (isClass(local)) next = { cls: local, module };
    else if (!imported) return globalEnd(owner, base.name, parent);
    else if (imported.from === HTTP) return `http:${imported.name}` in ERRORS ? { kind: "error", parent: parent ?? { id: `http:${imported.name}` } } : { kind: "plain" };
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
    at = next;
  }
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

function moduleOf(file: string, source: string): Module {
  const { program, errors } = parseSync(file, source);
  const locals = new Map<string, Value>();
  const imports = new Map<string, { from: string; name: string }>();
  const exports = new Map<string, Value>();

  for (const node of program.body) {
    const decl = node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration" ? node.declaration : node;

    if ((decl?.type === "FunctionDeclaration" || decl?.type === "ClassDeclaration") && decl.id) locals.set(decl.id.name, decl);

    if (decl?.type === "VariableDeclaration")
      for (const { id, init } of decl.declarations) if (id.type === "Identifier") locals.set(id.name, init);

    if (node.type === "ImportDeclaration" && node.importKind !== "type")
      for (const spec of node.specifiers) {
        if (spec.type === "ImportNamespaceSpecifier") continue;
        imports.set(spec.local.name, { from: node.source.value, name: spec.type === "ImportDefaultSpecifier" ? "default" : nameOf(spec.imported) });
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
