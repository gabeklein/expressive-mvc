import type { ESTree } from "vite";

import { moduleOf, nameOf, type Module, type Sources, type Value } from "./scan";

export interface Leaf {
  file: string;
  name: string;
}

export type Tree = Map<string, Tree | Leaf>;

export interface Trunk {
  tree: Tree;
  problems: string[];
}

const NAMED = "a leaf is a function or Error class imported by name from the module under the folder that defines it.";

export async function scanTrunk(file: string, source: string, sources: Sources, owned: (file: string) => boolean): Promise<Trunk> {
  const module = moduleOf(file, source);
  const problems = [...module.errors];
  const tree: Tree = new Map();

  for (const node of module.body) if (!allowed(node)) problems.push("A trunk exports its default object and types only.");

  const root = objectOf(module.exports.get("default"), module);

  if (!root) problems.push("A trunk's default is an object - its leaves are the calls the client gets.");
  else await branch(root, [], tree, module, sources, owned, problems);

  return { tree, problems };
}

export function leaves(tree: Tree, into = new Map<string, Set<string>>()): Map<string, Set<string>> {
  for (const value of tree.values())
    if (value instanceof Map) leaves(value, into);
    else into.set(value.file, (into.get(value.file) ?? new Set()).add(value.name));

  return into;
}

function allowed(node: Module["body"][number]): boolean {
  switch (node.type) {
    case "ExportAllDeclaration":
      return node.exportKind === "type";
    case "ExportNamedDeclaration":
      return node.exportKind === "type" || node.declaration?.type === "TSInterfaceDeclaration" || node.declaration?.type === "TSTypeAliasDeclaration";
    default:
      return true;
  }
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

async function branch(object: ESTree.ObjectExpression, path: string[], tree: Tree, module: Module, sources: Sources, owned: (file: string) => boolean, problems: string[]) {
  for (const prop of object.properties) {
    if (prop.type === "SpreadElement" || prop.computed || prop.kind !== "init" || prop.method) {
      problems.push(`${path.join(".") || "The trunk"} has a ${prop.type === "SpreadElement" ? "spread" : prop.computed ? "computed key" : "method"} - a trunk's keys are written out, each an object or an imported name.`);
      continue;
    }

    const key = prop.key.type === "Identifier" ? prop.key.name : String((prop.key as { value: unknown }).value);
    const at = [...path, key];
    const where = at.join(".");
    const value = unwrap(prop.value);
    const nested = objectOf(value, module);

    if (nested) {
      const sub: Tree = new Map();
      tree.set(key, sub);
      await branch(nested, at, sub, module, sources, owned, problems);
      continue;
    }

    const imported = value?.type === "Identifier" ? module.imports.get(value.name) : undefined;

    if (!imported || imported.type) {
      problems.push(`${where} is not an imported name - ${NAMED}`);
      continue;
    }

    const from = await sources.resolve(imported.from, module.file);
    const leaf = from ? await definition(from, imported.name, sources) : undefined;

    if (!leaf) problems.push(`${where} is ${imported.name} from "${imported.from}", which does not export it.`);
    else if (!owned(leaf.file)) problems.push(`${where} is defined outside the calls folder, in ${leaf.file} - ${NAMED}`);
    else if (leaf.name === "default") problems.push(`${where} is a default export - ${NAMED}`);
    else tree.set(key, leaf);
  }
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
