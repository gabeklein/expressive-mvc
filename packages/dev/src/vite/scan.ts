import { readFileSync } from "node:fs";
import { sep } from "node:path";
import { init, parse } from "es-module-lexer";
import { transformWithOxc, type ESTree } from "vite";
import * as root from "@expressive/rpc";
import { isClass, moduleOf, scanModule, type ErrorClass, type Module, type Sources, type Value } from "@expressive/rpc/vite";

import type { ExportScanner, Remote } from "./routes";

export const scanExports: ExportScanner = async (source, path) => {
  const { code } = await transformWithOxc(source, path, { jsx: { runtime: "automatic" } });

  await init;

  const entries = parse(code)[1];
  const entry = entries.find(entry => entry.n === "default");
  const local = entry && (entry.ln ?? /^\s+([\w$]+)\s*(?:;|$)/m.exec(code.slice(entry.e))?.[1]);
  const classDefault = local
    ? new RegExp(`\\bclass\\s+${local}\\b`).test(code)
    : /\bexport\s+default\s+(abstract\s+)?class\b/.test(code);

  return { exports: entries.map(entry => entry.n), classDefault };
};

export interface Twin {
  name: string;
  methods: string[];
  fields: string[];
  children?: Record<string, Twin>;
}

interface Pending {
  field: string;
  type: string;
  module: Module;
  owner: string;
}

export interface RemoteScan {
  calls: string[];
  errors: ErrorClass[];
  pooled: Twin[];
  seat?: Twin;
  problems: string[];
}

const RESERVED = new Set(["new", "use", "mount", "get", "set", "is"]);

export async function scanRemote(remote: Remote, source: string, sources: Sources, locate: (file: string) => Remote | undefined): Promise<RemoteScan> {
  const pooled: Twin[] = [];
  let seat: Twin | undefined;

  const owned = (file: string) => {
    const other = locate(file);
    return !!other && (remote.folder + sep).startsWith(other.folder + sep);
  };

  const { calls, errors, problems } = await scanModule(remote.file, source, sources, owned, {
    async claim(name) {
      const scan = await scanTwin(source, remote.file, sources, name);

      if (!scan.state) return;

      pooled.push(scan.twin!);
      return scan.problems;
    },
    async default(value) {
      if (remote.module) return ["Only a folder's remote entry - remote.ts or remote/index.ts - may export a default."];
      if (!isClass(value) || !value.superClass) return ["A remote default is a Model subclass - its methods are what the client calls."];

      const scan = await scanTwin(source, remote.file, sources);
      seat = scan.twin;

      return scan.problems;
    },
  });

  return { calls, errors, pooled, seat, problems };
}

export function hasSeat(file: string): boolean {
  const value = moduleOf(file, readFileSync(file, "utf8")).exports.get("default");
  return isClass(value) && !!value.superClass;
}

interface Found {
  cls: ESTree.Class;
  module: Module;
}

const LIBRARY = /^@expressive\//;
const ERRORS = "@expressive/rpc";

const isHttpError = (name: string) => {
  const Type = (root as Record<string, unknown>)[name];
  return typeof Type == "function" && Type.prototype instanceof Error;
};

export interface TwinScan {
  twin?: Twin;
  state: boolean;
  problems: string[];
}

export async function scanTwin(source: string, path: string, sources: Sources, name = "default"): Promise<TwinScan> {
  const module = declaredOf(path, source);
  const value = module.exports.get(name);

  if (!isClass(value)) return { state: false, problems: [] };

  const problems: string[] = [];
  const { twin, end } = await twinOf({ cls: value, module }, name === "default" ? value.id?.name ?? "default" : name, sources, problems, []);
  const state = !!end?.library;

  if (name !== "default") return state ? { twin, state, problems } : { state, problems: [] };
  if (end?.global) problems.push(`${end.owner} extends ${end.global}, which is neither declared nor imported in ${module.file}.`);
  if (end?.error) problems.push(`${end.owner} extends ${end.error}, an error class - a folder's default must be a Model.`);

  return { twin, state, problems };
}

async function twinOf(found: Found, name: string, sources: Sources, problems: string[], stack: string[]): Promise<{ twin: Twin; end?: Base }> {
  const twin: Twin = { name, methods: [], fields: [] };
  const seen = new Set<string>();
  const pending: Pending[] = [];
  const chain: Found[] = [];
  let at: Found | Base | undefined = found;

  while (at && "cls" in at) {
    const key = identity(at);
    const loop = chain.findIndex(found => identity(found) === key);

    if (loop >= 0) {
      const [first, ...rest] = chain.slice(loop).map(({ cls }) => cls.id?.name ?? "default");
      problems.push(`${first} extends ${[...rest, first].join(", which extends ")} - a class cannot extend itself.`);
      at = undefined;
    } else {
      chain.push(at);
      collect(at.cls, at.module, twin, seen, pending, problems);
      at = await baseOf(at, sources, problems);
    }
  }

  if (at?.library)
    for (const field of pending) await childOf(field, twin, sources, problems, [...stack, identity(found)]);

  return { twin, end: at };
}

async function childOf({ field, type, module, owner }: Pending, twin: Twin, sources: Sources, problems: string[], stack: string[]): Promise<void> {
  const found = await classNamed(type, module, sources);

  if (!found) return;
  if (stack.includes(identity(found))) return void problems.push(`${owner}.${field} holds a ${type}, which holds itself - a twin's children cannot recurse.`);

  const own: string[] = [];
  const child = await twinOf(found, type, sources, own, stack);

  if (!child.end?.library) return;

  problems.push(...own);
  (twin.children ??= {})[field] = child.twin;
}

function identity({ cls, module }: Found): string {
  return `${module.file}#${cls.start}`;
}

async function classNamed(name: string, module: Module, sources: Sources): Promise<Found | undefined> {
  const local = module.locals.get(name);

  if (isClass(local)) return { cls: local, module };

  const imported = module.imports.get(name);

  if (!imported || LIBRARY.test(imported.from)) return;

  const file = await sources.resolve(imported.from, module.file);

  if (!file) return;

  const typed = declarations(file, sources);
  const next = declaredOf(typed, sources.read(typed));
  const exported = next.exports.get(imported.name);

  return isClass(exported) ? { cls: exported, module: next } : undefined;
}

function collect(cls: ESTree.Class, module: Module, twin: Twin, seen: Set<string>, pending: Pending[], problems: string[]): void {
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

    if (member.type === "PropertyDefinition") {
      if (isReference(member.value, module)) {
        problems.push(`${owner}.${name} is a public reference - get() fields do not cross yet; declare it protected or private.`);
        continue;
      }

      const type = childType(member);
      if (type) pending.push({ field: name, type, module, owner });
    }

    if (member.type !== "MethodDefinition" || member.kind === "get") twin.fields.push(name);
    else if (member.kind !== "method") continue;
    else if (isAsync(member.value)) twin.methods.push(name);
    else problems.push(`${owner}.${name}() is not async - every call to it crosses the wire.`);
  }
}

function isReference(value: Value, module: Module): boolean {
  if (value?.type !== "CallExpression" || value.callee.type !== "Identifier") return false;

  const imported = module.imports.get(value.callee.name);

  return !!imported && imported.name === "get" && LIBRARY.test(imported.from);
}

function childType(member: ESTree.PropertyDefinition): string | undefined {
  const { value } = member;

  if (value?.type === "NewExpression" && value.callee.type === "Identifier") return value.callee.name;

  if (value?.type === "CallExpression" && value.callee.type === "MemberExpression") {
    const { object, property } = value.callee;
    if (object.type === "Identifier" && property.type === "Identifier" && property.name === "new") return object.name;
  }

  if (value && !(value.type === "Identifier" && value.name === "undefined")) return;

  return typeName(member.typeAnnotation?.typeAnnotation);
}

function typeName(type: ESTree.TSType | undefined): string | undefined {
  if (type?.type === "TSTypeReference") return type.typeName.type === "Identifier" ? type.typeName.name : undefined;
  if (type?.type !== "TSUnionType") return;

  const named = type.types.filter(member => member.type !== "TSUndefinedKeyword" && member.type !== "TSNullKeyword");

  return named.length === 1 ? typeName(named[0]) : undefined;
}

function isAsync(fn: ESTree.Function): boolean {
  const type = fn.returnType?.typeAnnotation;
  const promised = type?.type === "TSTypeReference" && type.typeName.type === "Identifier" && type.typeName.name === "Promise";

  return fn.async || promised;
}

interface Base {
  owner: string;
  library?: boolean;
  global?: string;
  error?: string;
}

async function baseOf({ cls, module }: Found, sources: Sources, problems: string[]): Promise<Found | Base | undefined> {
  const base = cls.superClass;
  const owner = cls.id?.name ?? "default";

  if (!base) return;

  if (base.type !== "Identifier")
    return void problems.push(`${owner} extends an expression - a twin's bases must be classes reached by name.`);

  const local = module.locals.get(base.name);

  if (isClass(local)) return { cls: local, module };

  const imported = module.imports.get(base.name);

  if (!imported || imported.type) return { owner, global: base.name };
  if (imported.from === ERRORS && isHttpError(imported.name)) return { owner, error: base.name };
  if (LIBRARY.test(imported.from)) return { owner, library: true };

  const file = await sources.resolve(imported.from, module.file);

  if (!file) return void problems.push(`${owner} extends ${base.name} from "${imported.from}", which does not resolve.`);

  const typed = declarations(file, sources);
  const next = declaredOf(typed, sources.read(typed));
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

function declaredOf(file: string, source: string): Module {
  const module = moduleOf(file, source);

  for (const node of module.body)
    if (node.type === "ExportNamedDeclaration" && node.declaration?.type === "ClassDeclaration" && node.declaration.id)
      module.exports.set(node.declaration.id.name, node.declaration);

  return module;
}
