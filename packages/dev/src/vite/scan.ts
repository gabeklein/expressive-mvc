import { init, parse } from "es-module-lexer";
import { parseSync, transformWithOxc, type ESTree } from "vite";

import type { ExportScanner } from "../routes";

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

export function scanSidecar(source: string, path: string): SidecarScan {
  const { program, errors } = parseSync(path, source);
  const calls: string[] = [];
  const classes: string[] = [];
  const problems = errors.map(error => error.message);
  const local = new Map<string, ESTree.Node | null | undefined>();

  for (const node of program.body) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;

    if ((decl?.type === "FunctionDeclaration" || decl?.type === "ClassDeclaration") && decl.id) local.set(decl.id.name, decl);
    if (decl?.type === "VariableDeclaration")
      for (const { id, init } of decl.declarations) if (id.type === "Identifier") local.set(id.name, init);
  }

  const check = (name: string, value: ESTree.Node | null | undefined) => {
    const fn = value?.type === "FunctionDeclaration" || value?.type === "FunctionExpression" || value?.type === "ArrowFunctionExpression";

    if (fn && value.async) calls.push(name);
    else if ((value?.type === "ClassDeclaration" || value?.type === "ClassExpression") && value.superClass) classes.push(name);
    else problems.push(`${name} is neither an async function nor an Error subclass - the client could not use it.`);
  };

  for (const node of program.body) {
    if (node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration" && node.source)
      problems.push("A sidecar cannot re-export from another module.");
    else if (node.type === "ExportDefaultDeclaration")
      problems.push("A sidecar's default export is not supported yet.");
    else if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type") continue;
    else if (node.declaration?.type === "FunctionDeclaration" || node.declaration?.type === "ClassDeclaration")
      check(node.declaration.id!.name, node.declaration);
    else if (node.declaration?.type === "VariableDeclaration")
      for (const { id, init } of node.declaration.declarations) check(id.type === "Identifier" ? id.name : "A destructured export", init);
    else if (node.declaration && node.declaration.type !== "TSInterfaceDeclaration" && node.declaration.type !== "TSTypeAliasDeclaration")
      problems.push("A sidecar exports async functions and Error subclasses only.");
    else
      for (const spec of node.specifiers)
        if (spec.exportKind !== "type")
          check(spec.exported.type === "Identifier" ? spec.exported.name : String(spec.exported.value), local.get(spec.local.type === "Identifier" ? spec.local.name : String(spec.local.value)));
  }

  return { calls, classes, problems };
}
