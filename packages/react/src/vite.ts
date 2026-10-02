import { dirname } from 'node:path';
import type { Plugin } from 'vite';

type Node = { type: string; [key: string]: any };

const SOURCE = /\.[cm]?[jt]sx?$/;

/**
 * Top-level classes a module can reassign, those declaring private members,
 * and its exports by local binding.
 */
function scan(body: Node[]) {
  const classes: string[] = [];
  const hidden: string[] = [];
  const exports: Record<string, string> = {};

  function add(name: string, node: Node) {
    classes.push(name);

    if (node.body.body.some((member: Node) => member.key?.type == 'PrivateIdentifier')) hidden.push(name);
  }

  function collect(node: Node) {
    if (node.type == 'ClassDeclaration' && node.id) add(node.id.name, node);
    else if (node.type == 'VariableDeclaration' && node.kind != 'const')
      for (const { id, init } of node.declarations)
        if (id.type == 'Identifier' && init?.type == 'ClassExpression') add(id.name, init);
  }

  function names(node: Node): string[] {
    if (node.type == 'VariableDeclaration')
      return node.declarations.flatMap(({ id }: Node) => (id.type == 'Identifier' ? [id.name] : []));

    return [node.id.name];
  }

  for (const node of body) {
    if (node.type == 'ExportNamedDeclaration') {
      if (node.declaration) {
        collect(node.declaration);
        for (const name of names(node.declaration)) exports[name] = name;
      } else if (!node.source)
        for (const { local, exported } of node.specifiers)
          exports[exported.name ?? exported.value] = local.name;
    } else if (node.type == 'ExportDefaultDeclaration') {
      const { declaration } = node;

      collect(declaration);

      if (declaration.id) exports.default = declaration.id.name;
    } else collect(node);
  }

  return { classes, hidden, exports };
}

const server = (notes: Record<string, string>, list: string) => `\
  const __notes = ${JSON.stringify(notes)};
  const __before = import.meta.hot.data.expressive;
  const __classes = (import.meta.hot.data.expressive = { ${list} });
  const __warned = (import.meta.hot.data.warned ||= {});
  for (const key in __notes)
    if (__before && __classes[key] !== __before[key] && !__warned[key]) {
      __warned[key] = true;
      console.warn(__notes[key]);
    }`;

const browser = (id: string, notes: Record<string, string>, list: string) => `\
  const __notes = ${JSON.stringify(notes)};
  const __flag = (key) => 'expressive:private:' + ${id} + ':' + key;
  for (const key in __notes)
    try {
      if (sessionStorage.getItem(__flag(key)) == 'due') {
        console.warn(__notes[key]);
        sessionStorage.setItem(__flag(key), 'shown');
      }
    } catch {}
  const __before = import.meta.hot.data.expressive;
  const __classes = (import.meta.hot.data.expressive = { ${list} });
  for (const key in __before)
    if (__classes[key] !== __before[key] && __classes[key]?.prototype instanceof __State) {
      const note = __notes[key];
      if (note)
        try {
          if (!sessionStorage.getItem(__flag(key))) sessionStorage.setItem(__flag(key), 'due');
        } catch {
          console.warn(note);
        }
      dispatchEvent(new CustomEvent('expressive:reload', { detail: { module: ${id}, class: key, reason: note ? 'private members' : 'class changed shape' } }));
      location.reload();
      break;
    }`;

const patchClasses = (id: string, classes: string[]) => `\
{
  const __hot = __accept(${id}, { ${classes.join(', ')} });
  ${classes.map((name) => `${name} = __hot.${name};`).join('\n  ')}
}`;

const acceptUpdates = (replace: string, record: string) => `\
if (import.meta.hot) {
${replace}
  const __exports = { ${record} };
  import.meta.hot.accept((next) => {
    if (!next) return;
    for (const key in __exports) {
      const after = next[key];
      if (after !== __exports[key] && !(after?.prototype instanceof __State) && (typeof after != 'function' || !/^[A-Z]/.test(after.name)))
        return import.meta.hot.invalidate(\`"\${key}" export cannot be hot-patched.\`);
    }
  });
}`;

/**
 * Bind a module's classes to `hot.accept`. A State class it could not patch
 * reloads the page; after an update, a changed component is left to React
 * Refresh and any other changed export invalidates importers.
 */
function inject(id: string, body: Node[], ssr = false) {
  const { classes, hidden, exports } = scan(body);

  if (!classes.length) return '';

  const key = JSON.stringify(id);
  const list = classes.join(', ');
  const record = Object.entries(exports).map(([name, local]) => `${JSON.stringify(name)}: ${local}`);
  const effect = ssr ? 'replace it instead of patching' : 'will trigger a full reload';
  const notes = Object.fromEntries(
    hidden.map((name) => [name, `[expressive] ${name} (${id}) declares #private members, so edits to its module ${effect}. Use _ properties instead to keep HMR.`])
  );
  const replace = ssr ? server(notes, list) : browser(key, notes, list);

  const lines = [
    `import { State as __State } from '@expressive/mvc';`,
    `import { accept as __accept } from '@expressive/mvc/hot';`,
    patchClasses(key, classes),
    acceptUpdates(replace, record.join(', '))
  ];

  return `\n${lines.join('\n')}\n`;
}

/** Hot-patch State and Component classes in place during `vite` dev. */
export default function expressive(): Plugin {
  let root = '';
  let runtime: Promise<string | null | undefined> | undefined;

  return {
    name: '@expressive/react:hot',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
    },
    async transform(code, id, options) {
      const [file] = id.split('?');

      if (!SOURCE.test(file) || file.includes('/node_modules/') || !code.includes('class'))
        return;

      runtime ||= this.resolve('@expressive/mvc/hot').then((found) => found && dirname(found.id));

      const own = await runtime;

      if (own && file.startsWith(own)) return;

      const output = inject(file.startsWith(root + '/') ? file.slice(root.length) : file, this.parse(code).body as Node[], options?.ssr);

      if (output) return { code: code + output, map: null };
    }
  };
}
