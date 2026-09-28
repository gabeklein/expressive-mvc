import { dirname } from 'node:path';
import type { Plugin } from 'vite';

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

/**
 * Bind a module's classes to `hot.accept`, then judge each update: a changed
 * class export reloads, a changed component is left to React Refresh, and any
 * other changed export invalidates importers.
 */
function inject(id: string, body: Node[]) {
  const { classes, exports } = scan(body);

  if (!classes.length) return '';

  const record = Object.entries(exports).map(([name, local]) => `${JSON.stringify(name)}: ${local}`);
  const reload = Object.keys(exports).filter((name) => classes.includes(exports[name]));

  return `
import { hot as __expressive } from '@expressive/mvc/runtime';
{
  const __hot = __expressive.accept(${JSON.stringify(id)}, { ${classes.join(', ')} });
  ${classes.map((name) => `${name} = __hot.${name};`).join('\n  ')}
}
if (import.meta.hot) {
  const __exports = { ${record.join(', ')} };
  import.meta.hot.accept((next) => {
    if (!next) return;
    for (const key of ${JSON.stringify(reload)})
      if (next[key] !== __exports[key])
        return typeof location == 'object' ? location.reload() : import.meta.hot.invalidate();
    for (const key in __exports) {
      const after = next[key];
      if (after !== __exports[key] && (typeof after != 'function' || !/^[A-Z]/.test(after.name)))
        return import.meta.hot.invalidate(\`"\${key}" export cannot be hot-patched.\`);
    }
  });
}
`;
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

      const output = inject(file, this.parse(code).body as Node[]);

      if (output) return { code: code + output, map: null };
    }
  };
}
