import { rechain } from './component';
import { event } from './observable';
import { State, handlers, patch, track } from './state';

interface Entry {
  type: Function;
  shape: string;
  kinds: Record<string, 'get' | 'fn'>;
  own: ReturnType<typeof handlers>;
}

/** An ESTree node, as Vite, Rollup, oxc or acorn parse one. */
type Node = { type: string; [key: string]: any };

const MODULES = new Map<string, Record<string, Entry>>();
const REFRESH = Symbol.for('@expressive/mvc.refresh');

function isState(value: unknown): value is State.Extends {
  return typeof value == 'function' && value.prototype instanceof State;
}

/** What a patch cannot carry: class source less its members, and member kinds. */
function describe(type: Function): Entry {
  const text = Function.prototype.toString;
  const kinds: Entry['kinds'] = {};
  let shape = text.call(type);

  for (const target of [type.prototype, type])
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(target)))
      for (const fn of [desc.value, desc.get, desc.set])
        if (typeof fn == 'function' && fn !== type) {
          shape = shape.replace(text.call(fn), '');
          if (target !== type) kinds[key] = desc.get ? 'get' : 'fn';
        }

  return { type, shape: shape.replace(/\s+/g, ' '), kinds, own: handlers(type as State.Extends) };
}

function compatible(prev: Entry, next: Entry) {
  if (prev.shape !== next.shape) return false;

  for (const key in next.kinds)
    if (key in prev.kinds && prev.kinds[key] !== next.kinds[key]) return false;

  return true;
}

/**
 * Keep a module's State classes stable across runs. A class seen before is
 * patched with its replacement and returned in its place, refreshing live
 * instances; one whose shape changed is returned as-is.
 */
function accept<T extends Record<string, unknown>>(id: string, classes: T): T {
  let known = MODULES.get(id);

  if (!known) MODULES.set(id, (known = {}));

  const output: Record<string, unknown> = { ...classes };
  const refresh = new Set<State>();

  track();

  for (const [name, type] of Object.entries(classes)) {
    if (!isState(type)) continue;

    const prev = known[name];

    if (prev?.type === type) continue;

    const next = describe(type);

    if (!prev || !compatible(prev, next)) {
      known[name] = next;
      continue;
    }

    try {
      for (const state of patch(prev.type as State.Extends, type, prev.own)) refresh.add(state);
      known[name] = { ...next, type: prev.type };
      output[name] = prev.type;
    } catch (error) {
      console.error(error);
      known[name] = next;
    }
  }

  if (refresh.size) {
    rechain();
    for (const state of refresh) event(state, REFRESH);
  }

  return output as T;
}

/**
 * Compare a module's exports across runs. Returns `'reload'` if a State class
 * changed shape, a message if another export importers hold went stale.
 */
function verify(prev: Record<string, unknown>, next?: Record<string, unknown>) {
  if (!next) return;

  for (const key of Object.keys(prev)) {
    const before = prev[key];
    const after = next[key];

    if (before === after) continue;

    if (isState(before) || isState(after)) return 'reload';

    if (typeof after != 'function' || !/^[A-Z]/.test(after.name))
      return `"${key}" export cannot be hot-patched.`;
  }
}

/** Code to append to a module, binding it to `accept` and `verify`. */
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
 * Code to append to a module, binding it to `accept` and `verify`.
 *
 * @param id - Stable per module; the same on every run.
 * @param program - The module parsed as ESTree.
 */
function inject(id: string, program: { body: Node[] }) {
  const { classes, exports } = scan(program.body);

  if (!classes.length) return '';

  const assign = classes.map((name) => `${name} = __hot.${name};`).join('\n  ');
  const record = Object.entries(exports)
    .map(([name, local]) => `${JSON.stringify(name)}: ${local}`)
    .join(', ');

  return `
import { hot as __expressive } from '@expressive/mvc/runtime';
{
  const __hot = __expressive.accept(${JSON.stringify(id)}, { ${classes.join(', ')} });
  ${assign}
}
if (import.meta.hot) {
  const __exports = { ${record} };
  import.meta.hot.accept((next) => {
    const verdict = __expressive.verify(__exports, next);
    if (verdict === 'reload' && typeof location == 'object') location.reload();
    else if (verdict) import.meta.hot.invalidate(verdict);
  });
}
`;
}

export { accept, inject, verify };
