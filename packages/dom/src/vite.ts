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

      if (declaration.id) exports.default = declaration.id.name;
    } else declare(node);
  }

  return { classes, exports };
}

/**
 * Bind a module's classes to `hot.accept`. A State class it could not patch
 * reloads the page; after an update, any other changed export invalidates
 * importers.
 */
function inject(id: string, body: Node[]) {
  const { classes, exports } = scan(body);

  if (!classes.length) return '';

  const list = classes.join(', ');
  const record = Object.entries(exports).map(([name, local]) => `${JSON.stringify(name)}: ${local}`);

  return `
import { hot as __expressive } from '@expressive/mvc/runtime';
import { State as __State } from '@expressive/mvc';
{
  const __hot = __expressive.accept(${JSON.stringify(id)}, { ${list} });
  ${classes.map((name) => `${name} = __hot.${name};`).join('\n  ')}
}
if (import.meta.hot) {
  const __before = import.meta.hot.data.expressive;
  const __classes = (import.meta.hot.data.expressive = { ${list} });
  for (const key in __before)
    if (__classes[key] !== __before[key] && __classes[key]?.prototype instanceof __State) {
      if (typeof location != 'object') import.meta.hot.invalidate();
      else {
        dispatchEvent(new CustomEvent('expressive:reload', { detail: { module: ${JSON.stringify(id)}, class: key, reason: 'class changed shape' } }));
        location.reload();
      }
      break;
    }
  const __exports = { ${record.join(', ')} };
  import.meta.hot.accept((next) => {
    if (!next) return;
    for (const key in __exports) {
      const after = next[key];
      if (after !== __exports[key] && !(after?.prototype instanceof __State))
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
    name: '@expressive/dom:hot',
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
