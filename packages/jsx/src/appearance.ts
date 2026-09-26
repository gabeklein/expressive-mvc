import { createAppearanceToken, registerAppearance, registerAppearanceRoot } from './appearance-protocol';
import type { AppearanceContext, Block, Declaration, ResolvedAppearance } from './appearance-protocol';

type StyleMap = Record<string, unknown>;

type Macro = (value: unknown, key: string) => unknown;
type Depths = ReadonlyMap<string, number>;

interface Expansion {
  block?: Block;
  classes: string[];
  declarations: Declaration;
  nested: StyleMap[];
}

interface StyleScope {
  children: WeakMap<object, StyleScope>;
  expansions: Map<string, Expansion>;
  label: string;
  labels: Record<string, string>;
  names: readonly string[];
  own: Declaration;
  routes: Map<string, AppearanceRoute>;
  rules: StyleMap;
}

interface AppearanceRoute {
  flags: readonly string[];
  scope: StyleScope;
  tag?: string;
}

const bases = new WeakMap<StyleScope, Declaration>();
const chains = new WeakMap<StyleScope, Map<string, Macro[]>>();
const contexts = new WeakMap<StyleScope, AppearanceContext>();
const rootScopes = new WeakMap<object, StyleScope>();
const styles = new WeakMap<object, StyleMap[]>();
const entered = new WeakSet<object>();
const globals: StyleMap[] = [];
let globalsEntered = false;
let globalContext: AppearanceContext | undefined;

function createStyleScope(parent: StyleScope | undefined, value: unknown, label?: string): StyleScope | undefined {
  if (!isObject(value)) return parent;

  const cache = parent?.children || rootScopes;
  const cached = cache.get(value);
  if (cached) return cached;

  const own: string[] = [];
  const source: StyleMap = {};
  const base: Declaration = {};

  for (const key of Object.keys(value)) {
    const entry = (value as StyleMap)[key];

    if (key[0] == '$')
      throw new Error(`Reserved key "${key}" in style map.`);

    if (key[0] == '_') {
      const name = key.slice(1);
      own.push(name);
      source[name] = entry;
    } else if (typeof entry == 'function') {
      own.push(key);
      source[key] = entry;
    } else base[key] = entry;
  }

  const names = parent
    ? [...parent.names, ...own.filter((name) => !parent.names.includes(name))]
    : own;
  const rules = Object.create(parent?.rules || null) as StyleMap;
  const labels = Object.create(parent?.labels || null) as Record<string, string>;
  const scopeLabel = label || parent?.label || 'style';

  for (const name of own) {
    const rule = source[name];
    const inherited = parent?.rules[name];
    rules[name] = isObject(inherited) && isObject(rule) ? { ...inherited, ...rule } : rule;
    labels[name] = scopeLabel;
  }

  const scope: StyleScope = {
    children: new WeakMap(),
    expansions: new Map(),
    label: scopeLabel,
    labels,
    names,
    own: base,
    routes: new Map(),
    rules
  };

  cache.set(value, scope);
  return scope;
}

function createContext(scope: StyleScope): AppearanceContext {
  const cached = contexts.get(scope);
  if (cached) return cached;

  const context: AppearanceContext = {
    scope,
    base: baseToken(scope),
    resolve(route, props, tag) {
      return resolveAppearance(route as AppearanceRoute | undefined, scope, props, tag);
    }
  };

  contexts.set(scope, context);
  return context;
}

function extendContext(parent: AppearanceContext | undefined, maps: readonly StyleMap[], label: string) {
  let scope = parent?.scope as StyleScope | undefined;
  const base: Declaration = { ...(scope && bases.get(scope)) };

  for (const map of maps) {
    scope = createStyleScope(scope, map, label);
    Object.assign(base, scope!.own);
  }

  if (Object.keys(base).length) bases.set(scope!, base);

  return createContext(scope!);
}

function baseToken(scope: StyleScope) {
  const base = bases.get(scope);
  if (!base) return undefined;

  const expansion = expand(scope, base, new Map());
  const appearance: ResolvedAppearance = {};

  if (Object.keys(expansion.declarations).length)
    appearance.blocks = [{ declarations: expansion.declarations, name: scope.label, ordinal: -1 }];

  if (expansion.classes.length) appearance.classes = expansion.classes;

  return createAppearanceToken(appearance);
}

function style<T extends object>(type: T, rules: StyleMap): T {
  if (entered.has(type)) throw new Error('Cannot add styles after a component has rendered.');

  const maps = styles.get(type);
  if (maps) maps.push(rules);
  else {
    const label = (type as { displayName?: string }).displayName || (type as Function).name;
    styles.set(type, [rules]);
    registerAppearance(type, (parent) => {
      entered.add(type);
      return extendContext(parent, styles.get(type)!, label);
    });
  }

  return type;
}

function macro(rules: StyleMap): StyleMap {
  if (globalsEntered) throw new Error('Cannot add macros after rendering has started.');
  globals.push(rules);
  globalContext = undefined;
  registerAppearanceRoot(() => {
    globalsEntered = true;
    return globalContext ||= extendContext(undefined, globals, 'global');
  });
  return rules;
}

function createAppearanceRoute(
  scope: StyleScope | undefined,
  props: Record<string, unknown>,
  tag?: string
): AppearanceRoute | undefined {
  if (!scope) return undefined;

  const keys = Object.keys(props).filter((key) => key.startsWith('_')).sort();
  const id = `${tag || ''}\0${keys.join('\0')}`;
  const cached = scope.routes.get(id);
  if (cached) return cached;

  const present = new Set(keys.map((key) => key.slice(1)));
  const flags: string[] = [];

  for (const name of scope.names) {
    if (!present.has(name) || name == tag) continue;
    if (isObject(scope.rules[name])) flags.push(name);
  }

  const route: AppearanceRoute = {
    flags,
    scope,
    tag: tag && isObject(scope.rules[tag]) ? tag : undefined
  };

  scope.routes.set(id, route);
  return route;
}

function resolveAppearance(
  route: AppearanceRoute | undefined,
  scope: StyleScope | undefined,
  props: Record<string, unknown>,
  tag?: string
): { appearance?: ResolvedAppearance; route?: AppearanceRoute } {
  if (!route || route.scope !== scope) route = createAppearanceRoute(scope, props, tag);
  if (!route) return {};

  const parts: Expansion[] = [];
  const names: string[] = route.tag ? [route.tag] : [];

  for (const name of route.flags)
    if (isPresent(props[`_${name}`])) names.push(name);

  for (const name of names)
    parts.push(expandRule(route.scope, name));

  const blocks = parts.flatMap((part) => part.block ? [part.block] : []);
  const classes = parts.flatMap((part) => part.classes);
  let child: StyleScope | undefined = route.scope;

  for (const part of parts)
    for (const nested of part.nested)
      child = createStyleScope(child, nested, tag ? `${route.scope.label}_${tag}` : route.scope.label);

  if (!blocks.length && !classes.length && child === route.scope)
    return { route };

  const appearance: ResolvedAppearance = {};
  if (blocks.length) appearance.blocks = blocks;
  if (classes.length) appearance.classes = classes;
  if (child !== route.scope) appearance.context = createContext(child!);

  return { appearance, route };
}

function expandRule(scope: StyleScope, name: string) {
  let expansion = scope.expansions.get(name);

  if (!expansion) {
    expansion = expand(scope, scope.rules[name], new Map());

    if (Object.keys(expansion.declarations).length)
      expansion.block = {
        declarations: expansion.declarations,
        name: `${scope.labels[name]}_${name}`,
        ordinal: scope.names.indexOf(name)
      };

    scope.expansions.set(name, expansion);
  }

  return expansion;
}

function handlers(scope: StyleScope, name: string) {
  let known = chains.get(scope);
  if (!known) chains.set(scope, (known = new Map()));

  let chain = known.get(name);

  if (!chain) {
    chain = [];

    for (const key of [name, '*'])
      for (let rules: object | null = scope.rules; rules; rules = Object.getPrototypeOf(rules)) {
        const own = Object.getOwnPropertyDescriptor(rules, key);
        if (own && typeof own.value == 'function') chain.push(own.value as Macro);
      }

    known.set(name, chain);
  }

  return chain;
}

function expand(scope: StyleScope, value: unknown, depths: Depths): Expansion {
  const output: Expansion = { classes: [], declarations: {}, nested: [] };
  const nested: StyleMap = {};

  function walk(value: unknown, depths: Depths) {
    if (!value) return;

    if (typeof value == 'string') {
      output.classes.push(...value.split(/\s+/).filter(Boolean));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, depths));
      return;
    }

    for (const [name, entry] of Object.entries(value as Declaration)) {
      if (name[0] == '_') {
        nested[name] = entry;
        continue;
      }

      const chain = handlers(scope, name);
      const depth = depths.get(name) || 0;

      if (depth < chain.length) {
        if (isPresent(entry))
          walk(
            chain[depth](entry === true ? undefined : entry, name),
            new Map(depths).set(name, depth + 1)
          );
      } else output.declarations[name] = terminal(name, entry);
    }
  }

  walk(value, depths);
  if (Object.keys(nested).length) output.nested.push(nested);
  return output;
}

function terminal(name: string, value: unknown) {
  if (Array.isArray(value)) return value.join(' ');

  if (typeof value == 'function' || isObject(value))
    throw new Error(`No macro handles "${name}".`);

  return typeof value == 'number' ? String(value) : value;
}

function isPresent(value: unknown) {
  return value !== false && value !== null && value !== undefined;
}

function isObject(value: unknown): value is Declaration {
  return !!value && typeof value == 'object' && !Array.isArray(value);
}

export { createAppearanceRoute, createStyleScope, macro, resolveAppearance, style };
export type { AppearanceRoute, StyleMap, StyleScope };
