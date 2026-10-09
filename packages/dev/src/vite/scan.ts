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

export interface SidecarScan {
  calls: string[];
  classes: string[];
  problems: string[];
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

export function scanSidecar(source: string, path: string): SidecarScan {
  const { program, errors } = parseSync(path, source);
  const scan: SidecarScan = { calls: [], classes: [], problems: errors.map(error => error.message) };
  const locals = localBindings(program.body);

  const check = (name: string, value: Value) => {
    const isAsyncFunction = isFunction(value) && value.async;
    const isSubclass = isClass(value) && !!value.superClass;

    if (isAsyncFunction) scan.calls.push(name);
    else if (isSubclass) scan.classes.push(name);
    else scan.problems.push(`${name} is neither an async function nor an Error subclass - the client could not use it.`);
  };

  for (const node of program.body) {
    const reExport = node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration" && !!node.source;

    if (reExport) {
      scan.problems.push("A sidecar cannot re-export from another module.");
      continue;
    }

    if (node.type === "ExportDefaultDeclaration") {
      scan.problems.push("A sidecar's default export is not supported yet.");
      continue;
    }

    if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type") continue;

    const { declaration } = node;

    if (!declaration)
      for (const spec of node.specifiers) {
        if (spec.exportKind !== "type") check(nameOf(spec.exported), locals.get(nameOf(spec.local)));
      }
    else if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration")
      check(declaration.id!.name, declaration);
    else if (declaration.type === "VariableDeclaration")
      for (const { id, init } of declaration.declarations) {
        const name = id.type === "Identifier" ? id.name : "A destructured export";
        check(name, init);
      }
    else if (!isType(declaration))
      scan.problems.push("A sidecar exports async functions and Error subclasses only.");
  }

  return scan;
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
