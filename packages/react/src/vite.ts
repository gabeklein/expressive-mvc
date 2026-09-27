import { dirname } from 'node:path';
import type { Plugin } from 'vite';
import { hot } from '@expressive/mvc/runtime';

type Node = { type: string; [key: string]: any };

const SOURCE = /\.[cm]?[jt]sx?$/;

/** Top-level classes a module can reassign, and its exports by local binding. */
function scan(body: Node[]) {
  const classes: string[] = [];
  const exports: Record<string, string> = {};

  function declare(node: Node) {
    if (node.type == 'ClassDeclaration' && node.id) classes.push(node.id.name);
    else if (node.type == 'VariableDeclaration' && node.kind != 'const')
      for (const { id, init } of node.declarations)
        if (id.type == 'Identifier' && init?.type == 'ClassExpression') classes.push(id.name);
  }

  function names(node: Node): string[] {
    if (node.type == 'VariableDeclaration')
      return node.declarations.flatMap(({ id }: Node) => (id.type == 'Identifier' ? [id.name] : []));

    return [node.id.name];
  }

  for (const node of body) {
    if (node.type == 'ExportNamedDeclaration') {
      if (node.declaration) {
        declare(node.declaration);
        for (const name of names(node.declaration)) exports[name] = name;
      } else if (!node.source)
        for (const { local, exported } of node.specifiers)
          exports[exported.name ?? exported.value] = local.name;
    } else if (node.type == 'ExportDefaultDeclaration') {
      const { declaration } = node;

      declare(declaration);

      if (declaration.type == 'Identifier') exports.default = declaration.name;
      else if (declaration.id) exports.default = declaration.id.name;
    } else declare(node);
  }

  return { classes, exports };
}

/** Hot-patch State and Component classes in place during `vite` dev. */
export default function expressive(): Plugin {
  let runtime: Promise<string | null | undefined> | undefined;

  return {
    name: '@expressive/react:hot',
    apply: 'serve',
    enforce: 'post',
    async transform(code, id) {
      const [file] = id.split('?');

      if (!SOURCE.test(file) || file.includes('/node_modules/') || !code.includes('class'))
        return;

      runtime ||= this.resolve('@expressive/mvc/runtime').then((found) => found && dirname(found.id));

      const own = await runtime;

      if (own && file.startsWith(own)) return;

      const output = hot.inject({ id: file, ...scan(this.parse(code).body as Node[]) });

      if (output) return { code: code + output, map: null };
    }
  };
}
