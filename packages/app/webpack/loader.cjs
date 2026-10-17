const { parse } = require('acorn');
const { existsSync } = require('node:fs');
const { dirname, join, relative } = require('node:path');

const COMPONENT = /^[A-Z]/;
const FUNCTION = ['ArrowFunctionExpression', 'FunctionExpression'];
const OWN = ['@expressive/mvc', '@expressive/jsx', '@expressive/app'];

function scan(body) {
  const classes = [];
  const hidden = [];
  const components = [];
  const exports = {};

  function add(name, node) {
    classes.push(name);

    if (node.body.body.some((member) => member.key && member.key.type == 'PrivateIdentifier')) hidden.push(name);
  }

  function collect(node) {
    if (node.type == 'ClassDeclaration' && node.id) add(node.id.name, node);
    else if (node.type == 'FunctionDeclaration' && node.id && COMPONENT.test(node.id.name)) components.push(node.id.name);
    else if (node.type == 'VariableDeclaration')
      for (const { id, init } of node.declarations) {
        if (id.type != 'Identifier' || !init) continue;
        if (init.type == 'ClassExpression' && node.kind != 'const') add(id.name, init);
        else if (FUNCTION.includes(init.type) && COMPONENT.test(id.name)) components.push(id.name);
      }
  }

  function names(node) {
    if (node.type == 'VariableDeclaration')
      return node.declarations.flatMap(({ id }) => (id.type == 'Identifier' ? [id.name] : []));

    return node.id ? [node.id.name] : [];
  }

  for (const node of body) {
    if (node.type == 'ExportNamedDeclaration') {
      if (node.declaration) {
        collect(node.declaration);
        for (const name of names(node.declaration)) exports[name] = name;
      } else if (!node.source)
        for (const { local, exported } of node.specifiers)
          exports[exported.name || exported.value] = local.name;
    } else if (node.type == 'ExportDefaultDeclaration') {
      collect(node.declaration);
      if (node.declaration.id) exports.default = node.declaration.id.name;
    } else collect(node);
  }

  return { classes, hidden, components, exports };
}

function inject(id, body) {
  const { classes, hidden, components, exports } = scan(body);

  if (!classes.length && !components.length) return '';

  const key = JSON.stringify(id);
  const list = classes.join(', ');
  const record = Object.entries(exports).map(([name, local]) => `${JSON.stringify(name)}: ${local}`).join(', ');
  const refresh = JSON.stringify(Object.keys(exports).filter((name) => components.includes(exports[name])));
  const notes = JSON.stringify(Object.fromEntries(
    hidden.map((name) => [name, `[expressive] ${name} (${id}) declares #private members, so edits to its module restart the app. Use _ properties instead to keep HMR.`])
  ));

  return `
import { Model as __Model } from '@expressive/mvc';
${classes.length ? `import { accept as __accept } from '@expressive/mvc/hot';` : ''}
${components.length ? `import { hot as __refresh } from '@expressive/jsx/jsx-dev-runtime';` : ''}
${classes.length ? `{
  const __hot = __accept(${key}, { ${list} });
  ${classes.map((name) => `${name} = __hot.${name};`).join('\n  ')}
}` : ''}
${components.length ? `__refresh(${key}, { ${components.join(', ')} });` : ''}
if (module.hot) {
  const __notes = ${notes};
  const __data = module.hot.data || {};
  const __classes = { ${list} };
  const __exports = { ${record} };
  let __stale;

  for (const key in __data.classes)
    if (__classes[key] !== __data.classes[key] && __classes[key]?.prototype instanceof __Model) {
      if (__notes[key]) console.warn(__notes[key]);
      __stale = key;
    }

  for (const key in __data.exports) {
    const after = __exports[key];
    if (after !== __data.exports[key] && !(after?.prototype instanceof __Model) && !${refresh}.includes(key)) __stale = key;
  }

  module.hot.dispose((data) => {
    data.classes = __classes;
    data.exports = __exports;
  });

  if (__stale) {
    console.log('[expressive] "' + __stale + '" (' + ${key} + ') cannot be hot-patched; restarting.');
    module.hot.invalidate();
  } else module.hot.accept();
}
`;
}

let own;

module.exports = function expressiveHot(source, map) {
  const root = this.rootContext;
  const file = this.resourcePath;

  own ||= OWN.flatMap((name) => {
    try {
      let dir = dirname(require.resolve(name, { paths: [root] }));
      while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir);
      return [dir];
    } catch {
      return [];
    }
  });

  if (!this.hot || file.includes('/node_modules/') || own.some((dir) => file.startsWith(dir + '/'))) return this.callback(null, source, map);

  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const output = inject('/' + relative(root, file), ast.body);

  this.callback(null, output ? source + output : source, map);
};
