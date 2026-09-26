import { registerAppearance, registerAppearanceRoot } from './appearance-protocol';
import type { AppearanceContext, Block, Declaration, ResolvedAppearance } from './appearance-protocol';

type Expression = string | Declaration | false | null | undefined | readonly Expression[];
type Macro = (value?: unknown) => Expression;
type StyleMap = Record<string, Declaration | Macro>;

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
  routes: Map<string, AppearanceRoute>;
  rules: StyleMap;
}

interface AppearanceRoute {
  flags: readonly string[];
  scope: StyleScope;
  tag?: string;
}

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

  const own = Object.keys(value);
  const names = parent
    ? [...parent.names, ...own.filter((name) => !parent.names.includes(name))]
    : own;
  const rules = Object.create(parent?.rules || null) as StyleMap;
  const labels = Object.create(parent?.labels || null) as Record<string, string>;
  const scopeLabel = label || parent?.label || 'style';

  for (const name of own) {
    const rule = (value as StyleMap)[name];
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
    resolve(route, tag, props) {
      return resolveAppearance(route as AppearanceRoute | undefined, scope, tag, props);
    }
  };

  contexts.set(scope, context);
  return context;
}

function extendContext(parent: AppearanceContext | undefined, maps: readonly StyleMap[], label: string) {
  let scope = parent?.scope as StyleScope | undefined;
  for (const map of maps) scope = createStyleScope(scope, map, label);
  return createContext(scope!);
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
  tag: string,
  props: Record<string, unknown>
): AppearanceRoute | undefined {
  if (!scope) return undefined;

  const keys = Object.keys(props).filter((key) => key.startsWith('_')).sort();
  const id = `${tag}\0${keys.join('\0')}`;
  const cached = scope.routes.get(id);
  if (cached) return cached;

  const present = new Set(keys.map((key) => key.slice(1)));
  const flags: string[] = [];

  for (const name of scope.names) {
    const rule = scope.rules[name];
    if (!present.has(name) || name == tag) continue;
    if (isObject(rule)) flags.push(name);
  }

  const route: AppearanceRoute = {
    flags,
    scope,
    tag: isObject(scope.rules[tag]) ? tag : undefined
  };

  scope.routes.set(id, route);
  return route;
}

function resolveAppearance(
  route: AppearanceRoute | undefined,
  scope: StyleScope | undefined,
  tag: string,
  props: Record<string, unknown>
): { appearance?: ResolvedAppearance; route?: AppearanceRoute } {
  if (!route || route.scope !== scope) route = createAppearanceRoute(scope, tag, props);
  if (!route) return {};

  const parts: Expansion[] = [];
  const names = route.tag ? [route.tag] : [];

  for (const name of route.flags)
    if (isPresent(props[`_${name}`])) names.push(name);

  for (const name of names)
    parts.push(expandRule(route.scope, name));

  const blocks = parts.flatMap((part) => part.block ? [part.block] : []);
  const classes = parts.flatMap((part) => part.classes);
  let child: StyleScope | undefined = route.scope;

  for (const part of parts)
    for (const nested of part.nested)
      child = createStyleScope(child, nested, `${route.scope.label}_${tag}`);

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
    expansion = expand(scope, scope.rules[name], []);

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

function expand(scope: StyleScope, value: unknown, stack: string[]): Expansion {
  const output: Expansion = { classes: [], declarations: {}, nested: [] };
  const nested: StyleMap = {};

  function walk(value: unknown, stack: string[]) {
    if (!value) return;

    if (typeof value == 'string') {
      output.classes.push(...value.split(/\s+/).filter(Boolean));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, stack));
      return;
    }

    for (const [name, entry] of Object.entries(value as Declaration)) {
      const rule = scope.rules[name];

      if (typeof rule == 'function' && !stack.includes(name)) {
        if (isPresent(entry)) walk(rule(entry === true ? undefined : entry), [...stack, name]);
      } else if (isObject(entry))
        nested[name] = entry;
      else output.declarations[name] = entry;
    }
  }

  walk(value, stack);
  if (Object.keys(nested).length) output.nested.push(nested);
  return output;
}

function isPresent(value: unknown) {
  return value !== false && value !== null && value !== undefined;
}

function isObject(value: unknown): value is Declaration {
  return !!value && typeof value == 'object' && !Array.isArray(value);
}

export { createAppearanceRoute, createStyleScope, macro, resolveAppearance, style };
export type { AppearanceRoute, StyleMap, StyleScope };
