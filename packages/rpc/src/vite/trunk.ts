import type { ESTree } from "vite";

import { moduleOf, nameOf, type Module, type Sources, type Value } from "./scan";

export interface Leaf {
  file: string;
  name: string;
}

export type Tree = Map<string, Tree | Leaf>;

export interface Trunk {
  /** The trunk's groups and imported leaves, by export name. */
  tree: Tree;
  /** Its other named exports - the index's own calls and Error classes. */
  own: string[];
  problems: string[];
}

type Imported = ReturnType<Module["imports"]["get"]>;
type Context = { module: Module; sources: Sources; owned: (file: string) => boolean; problems: string[] };

const NAMED = "a leaf is a function or Error class imported by name from the module under the trunk's folder that defines it.";

/** An index exporting an object - a group of calls - is its folder's trunk; its default stays the gate. */
export function isTrunk(module: Module): boolean {
  return [...module.exports].some(([name, value]) => name !== "default" && !!objectOf(value, module));
}

export async function scanTrunk(file: string, source: string, sources: Sources, owned: (file: string) => boolean): Promise<Trunk> {
  const module = moduleOf(file, source);
  const context: Context = { module, sources, owned, problems: [...module.errors] };
  const tree: Tree = new Map();
  const own: string[] = [];

  for (const node of module.body) {
    if (node.type === "ExportAllDeclaration" && node.exportKind !== "type")
      context.problems.push("A trunk names each export - export * would hide which calls cross.");

    if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type") continue;

    const { declaration } = node;

    if (declaration?.type === "VariableDeclaration") {
      for (const { id, init } of declaration.declarations)
        if (id.type === "Identifier") await entry(id.name, init, importOf(init, module), tree, own, context);
        else context.problems.push("A destructured export is neither an async function nor an Error subclass - the client could not use it.");
    }
    else if ((declaration?.type === "FunctionDeclaration" || declaration?.type === "ClassDeclaration") && declaration.id) own.push(declaration.id.name);
    else if (declaration) context.problems.push("A server module exports async functions and Error subclasses only.");

    for (const spec of node.specifiers) {
      if (spec.exportKind === "type") continue;

      const name = nameOf(spec.exported);
      const local = nameOf(spec.local);

      if (node.source) await leaf(name, { from: node.source.value, name: local }, tree, context);
      else await entry(name, module.locals.get(local), module.imports.get(local), tree, own, context);
    }
  }

  return { tree, own, problems: context.problems };
}

export function leaves(tree: Tree, into = new Map<string, Set<string>>()): Map<string, Set<string>> {
  for (const value of tree.values())
    if (value instanceof Map) leaves(value, into);
    else into.set(value.file, (into.get(value.file) ?? new Set()).add(value.name));

  return into;
}

function importOf(value: Value, module: Module): Imported {
  value = unwrap(value);
  return value?.type === "Identifier" ? module.imports.get(value.name) : undefined;
}

function unwrap(value: Value): Value {
  while (value?.type === "TSAsExpression" || value?.type === "TSSatisfiesExpression" || value?.type === "ParenthesizedExpression") value = value.expression;

  return value;
}

function objectOf(value: Value, module: Module, seen = new Set<string>()): ESTree.ObjectExpression | undefined {
  value = unwrap(value);

  if (value?.type === "Identifier" && !seen.has(value.name)) return objectOf(module.locals.get(value.name), module, seen.add(value.name));
  if (value?.type === "ObjectExpression") return value;
}

/** A top-level export: a group, an imported leaf, or the index's own. */
async function entry(name: string, value: Value, imported: Imported, tree: Tree, own: string[], context: Context) {
  const object = objectOf(value, context.module);

  if (object) {
    const group: Tree = new Map();
    tree.set(name, group);
    await branch(object, [name], group, context);
  }
  else if (imported && !imported.type) await leaf(name, imported, tree, context);
  else own.push(name);
}

async function branch(object: ESTree.ObjectExpression, path: string[], tree: Tree, context: Context) {
  const { module, problems } = context;

  for (const prop of object.properties) {
    if (prop.type === "SpreadElement" || prop.computed || prop.kind !== "init" || prop.method) {
      problems.push(`${path.join(".")} has a ${prop.type === "SpreadElement" ? "spread" : prop.computed ? "computed key" : "method"} - a trunk's keys are written out, each an object or an imported name.`);
      continue;
    }

    const key = prop.key.type === "Identifier" ? prop.key.name : String((prop.key as { value: unknown }).value);
    const at = [...path, key];
    const value = unwrap(prop.value);
    const nested = objectOf(value, module);

    if (nested) {
      const sub: Tree = new Map();
      tree.set(key, sub);
      await branch(nested, at, sub, context);
      continue;
    }

    const imported = importOf(value, module);

    if (!imported || imported.type) problems.push(`${at.join(".")} is not an imported name - ${NAMED}`);
    else await leaf(key, imported, tree, context, at.join("."));
  }
}

async function leaf(key: string, imported: { from: string; name: string }, tree: Tree, { module, sources, owned, problems }: Context, where = key) {
  const from = await sources.resolve(imported.from, module.file);
  const found = from ? await definition(from, imported.name, sources) : undefined;

  if (!found) problems.push(`${where} is ${imported.name} from "${imported.from}", which does not export it.`);
  else if (!owned(found.file)) problems.push(`${where} is defined outside the trunk's folder, in ${found.file} - ${NAMED}`);
  else if (found.name === "default") problems.push(`${where} is a default export - ${NAMED}`);
  else tree.set(key, found);
}

/** Where `name` is declared, following re-exports and exported imports to the module that defines it. */
export async function definition(file: string, name: string, sources: Sources, seen = new Set<string>()): Promise<Leaf | undefined> {
  const key = `${file}#${name}`;

  if (seen.has(key)) return;
  seen.add(key);

  const module = moduleOf(file, sources.read(file));
  const follow = async (spec: string, name: string) => {
    const next = await sources.resolve(spec, file);
    return next ? definition(next, name, sources, seen) : undefined;
  };

  for (const node of module.body) {
    if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type") continue;

    for (const spec of node.specifiers) {
      if (spec.exportKind === "type" || nameOf(spec.exported) !== name) continue;

      const local = nameOf(spec.local);
      const imported = module.imports.get(local);

      if (node.source) return follow(node.source.value, local);
      if (imported && !imported.type) return follow(imported.from, imported.name);
    }
  }

  if (module.exports.has(name)) return { file, name };

  for (const node of module.body) {
    if (node.type !== "ExportAllDeclaration" || node.exportKind === "type" || node.exported) continue;

    const found = await follow(node.source.value, name);

    if (found) return found;
  }
}
