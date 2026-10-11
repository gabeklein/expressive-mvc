import { init, parse } from "es-module-lexer";
import { parseSync, transformWithOxc, type ESTree } from "vite";

import type { ExportScanner } from "./routes";

export const scanExports: ExportScanner = async (source, path) => {
  const { code } = await transformWithOxc(source, path, { jsx: { runtime: "automatic" } });

  await init;

  const entries = parse(code)[1];
  const local = entries.find(entry => entry.n === "default")?.ln;
  const classDefault = local
    ? new RegExp(`\\bclass\\s+${local}\\b`).test(code)
    : /\bexport\s+default\s+(abstract\s+)?class\b/.test(code);

  return { exports: entries.map(entry => entry.n), classDefault };
};

export interface Twin {
  name: string;
  methods: string[];
  fields: string[];
}

export interface SidecarScan {
  calls: string[];
  classes: string[];
  seat?: string;
  problems: string[];
}

export interface Sources {
  resolve(spec: string, importer: string): Promise<string | undefined>;
  read(file: string): string;
}

type Value = ESTree.Node | null | undefined;

const isFunction = (value: Value): value is ESTree.Function | ESTree.ArrowFunctionExpression =>
  value?.type === "FunctionDeclaration" || value?.type === "FunctionExpression" || value?.type === "ArrowFunctionExpression";

const isClass = (value: Value): value is ESTree.Class =>
  value?.type === "ClassDeclaration" || value?.type === "ClassExpression";

const isType = (value: Value) =>
  value?.type === "TSInterfaceDeclaration" || value?.type === "TSTypeAliasDeclaration";

const nameOf = (node: ESTree.ModuleExportName) =>
  node.type === "Identifier" ? node.name : String(node.value);

type Statement = ESTree.Program["body"][number];
type Exported = [name: string, value: Value];

const RESERVED = new Set(["new", "use", "mount", "get", "set", "is"]);

export function scanSidecar(source: string, path: string, entry = true): SidecarScan {
  const { program, errors } = parseSync(path, source);
  const scan: SidecarScan = { calls: [], classes: [], problems: errors.map(error => error.message) };
  const locals = localBindings(program.body);

  for (const node of program.body) {
    const problem = unsupported(node);

    if (problem) scan.problems.push(problem);
    else
      for (const [name, value] of exportsOf(node, locals))
        if (name === "default") seat(scan, value, entry);
        else check(scan, name, value);
  }

  return scan;
}

function unsupported(node: Statement): string | undefined {
  switch (node.type) {
    case "ExportAllDeclaration":
      return "A sidecar cannot re-export from another module.";
    case "ExportNamedDeclaration": {
      const { declaration } = node;

      if (node.source) return "A sidecar cannot re-export from another module.";
      if (node.exportKind === "type" || !declaration || isType(declaration)) return;

      switch (declaration.type) {
        case "FunctionDeclaration":
        case "ClassDeclaration":
        case "VariableDeclaration":
          return;
        default:
          return "A sidecar exports async functions and Error subclasses only.";
      }
    }
  }
}

function exportsOf(node: Statement, locals: Map<string, Value>): Exported[] {
  if (node.type === "ExportDefaultDeclaration") {
    const { declaration } = node;
    return [["default", declaration.type === "Identifier" ? locals.get(declaration.name) : declaration as Value]];
  }

  if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type") return [];

  const { declaration } = node;

  if (!declaration)
    return node.specifiers
      .filter(spec => spec.exportKind !== "type")
      .map(spec => [nameOf(spec.exported), locals.get(nameOf(spec.local))]);

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

function check(scan: SidecarScan, name: string, value: Value): void {
  const isAsyncFunction = isFunction(value) && value.async;
  const isSubclass = isClass(value) && !!value.superClass;

  if (isAsyncFunction) scan.calls.push(name);
  else if (isSubclass) scan.classes.push(name);
  else scan.problems.push(`${name} is neither an async function nor an Error subclass - the client could not use it.`);
}

function seat(scan: SidecarScan, value: Value, entry: boolean): void {
  if (!entry) return void scan.problems.push("Only a folder's remote entry - remote.ts or remote/index.ts - may export a default.");
  if (!isClass(value) || !value.superClass) return void scan.problems.push("A remote default is a State subclass - its methods are what the client calls.");

  scan.seat = value.id?.name ?? "default";
}

interface Found {
  cls: ESTree.Class;
  module: Module;
}

interface Module {
  file: string;
  locals: Map<string, Value>;
  imports: Map<string, { from: string; name: string }>;
  exports: Map<string, Value>;
}

const LIBRARY = /^@expressive\//;

export async function scanTwin(source: string, path: string, sources: Sources): Promise<{ twin?: Twin; problems: string[] }> {
  const module = moduleOf(path, source);
  const value = module.exports.get("default");

  if (!isClass(value)) return { problems: [] };

  const twin: Twin = { name: value.id?.name ?? "default", methods: [], fields: [] };
  const problems: string[] = [];
  const seen = new Set<string>();

  for (let at: Found | undefined = { cls: value, module }; at; at = await baseOf(at, sources, problems))
    collect(at.cls, twin, seen, problems);

  return { twin, problems };
}

function collect(cls: ESTree.Class, twin: Twin, seen: Set<string>, problems: string[]): void {
  const owner = cls.id?.name ?? twin.name;

  for (const member of cls.body.body) {
    if (member.type !== "MethodDefinition" && member.type !== "PropertyDefinition") continue;
    if (member.static || member.computed || member.key.type !== "Identifier") continue;
    if (member.type === "MethodDefinition" && member.kind === "constructor") continue;

    const { name } = member.key;

    if (seen.has(name)) continue;
    seen.add(name);

    const hidden = member.accessibility === "private" || member.accessibility === "protected" || name.startsWith("_") || RESERVED.has(name);

    if (hidden) continue;

    if (member.type !== "MethodDefinition" || member.kind === "get") twin.fields.push(name);
    else if (member.kind !== "method") continue;
    else if (isAsync(member.value)) twin.methods.push(name);
    else problems.push(`${owner}.${name}() is not async - every call to it crosses the wire.`);
  }
}

function isAsync(fn: ESTree.Function): boolean {
  const type = fn.returnType?.typeAnnotation;
  const promised = type?.type === "TSTypeReference" && type.typeName.type === "Identifier" && type.typeName.name === "Promise";

  return fn.async || promised;
}

async function baseOf({ cls, module }: Found, sources: Sources, problems: string[]): Promise<Found | undefined> {
  const base = cls.superClass;
  const owner = cls.id?.name ?? "default";

  if (!base) return;

  if (base.type !== "Identifier")
    return void problems.push(`${owner} extends an expression - a twin's bases must be classes reached by name.`);

  const local = module.locals.get(base.name);

  if (isClass(local)) return { cls: local, module };

  const imported = module.imports.get(base.name);

  if (!imported) return void problems.push(`${owner} extends ${base.name}, which is neither declared nor imported in ${module.file}.`);
  if (LIBRARY.test(imported.from)) return;

  const file = await sources.resolve(imported.from, module.file);

  if (!file) return void problems.push(`${owner} extends ${base.name} from "${imported.from}", which does not resolve.`);

  const typed = declarations(file, sources);
  const next = moduleOf(typed, sources.read(typed));
  const exported = next.exports.get(imported.name);

  if (!isClass(exported)) return void problems.push(`${owner} extends ${base.name}, which ${typed} does not export as a class.`);

  return { cls: exported, module: next };
}

function declarations(file: string, sources: Sources): string {
  const typed = file.replace(/\.([cm]?)js$/, ".d.$1ts");

  if (typed === file) return file;

  try {
    sources.read(typed);
    return typed;
  } catch {
    return file;
  }
}

function moduleOf(file: string, source: string): Module {
  const { program } = parseSync(file, source);
  const locals = localBindings(program.body);
  const imports = new Map<string, { from: string; name: string }>();
  const exports = new Map<string, Value>();

  for (const node of program.body) {
    if (node.type === "ImportDeclaration")
      for (const spec of node.specifiers ?? []) {
        if (spec.type === "ImportNamespaceSpecifier") continue;
        const name = spec.type === "ImportDefaultSpecifier" ? "default" : nameOf(spec.imported);
        imports.set(spec.local.name, { from: node.source.value, name });
      }

    for (const [name, value] of exportsOf(node, locals)) exports.set(name, value);

    const declared = node.type === "ExportNamedDeclaration" && node.declaration?.type === "ClassDeclaration" && node.declaration;

    if (declared && declared.id) exports.set(declared.id.name, declared);
  }

  return { file, locals, imports, exports };
}

function localBindings(body: ESTree.Program["body"]): Map<string, Value> {
  const locals = new Map<string, Value>();

  for (const node of body) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
    const named = (decl?.type === "FunctionDeclaration" || decl?.type === "ClassDeclaration") && decl.id;

    if (named) locals.set(named.name, decl);

    if (decl?.type === "VariableDeclaration")
      for (const { id, init } of decl.declarations)
        if (id.type === "Identifier") locals.set(id.name, init);
  }

  return locals;
}
