import { registerAppearance, registerAppearanceRoot } from './appearance-protocol';
import type { AppearanceContext, Declaration, ResolvedAppearance } from './appearance-protocol';
import { applyDeclarations } from './declarations';

type Expression = string | Declaration | false | null | undefined | readonly Expression[];
type Rule = Declaration | ((value?: unknown) => Expression);
type StyleMap = Record<string, Rule>;

interface StyleScope {
  children: WeakMap<object, StyleScope>;
  names: readonly string[];
  routes: Map<string, AppearanceRoute>;
  rules: StyleMap;
}

interface Selector {
  bit: number;
  name: string;
  parameter: boolean;
  rule: Rule;
}

interface Invocation {
  rule: Rule;
  value?: unknown;
}

interface AppearanceRoute {
  cache: Map<string, ResolvedAppearance>;
  scope: StyleScope;
  selectors: readonly Selector[];
  shape: string;
  tag?: Rule;
}

interface Sheet {
  classes: Map<string, string>;
  count: number;
  element: HTMLStyleElement;
}

const CACHE_LIMIT = 8;
const contexts = new WeakMap<StyleScope, AppearanceContext>();
const rootScopes = new WeakMap<object, StyleScope>();
const sheets = new WeakMap<Document, Sheet>();
const styles = new WeakMap<object, StyleMap[]>();
const entered = new WeakSet<object>();
const globals: StyleMap[] = [];
let globalsEntered = false;
let globalContext: AppearanceContext | undefined;

function createStyleScope(parent: StyleScope | undefined, value: unknown): StyleScope | undefined {
  if (!value || typeof value != 'object' || Array.isArray(value)) return parent;

  const cache = parent?.children || rootScopes;
  const cached = cache.get(value);
  if (cached) return cached;

  const own = Object.keys(value);
  const names = parent
    ? [...parent.names, ...own.filter((name) => !parent.names.includes(name))]
    : own;
  const rules = Object.create(parent?.rules || null) as StyleMap;

  for (const name of own) {
    const rule = (value as StyleMap)[name];
    const inherited = parent?.rules[name];
    rules[name] = isObjectRule(inherited) && isObjectRule(rule)
      ? { ...inherited, ...rule }
      : rule;
  }
  const scope = { children: new WeakMap(), names, routes: new Map(), rules };

  cache.set(value, scope);
  return scope;
}

function createContext(scope: StyleScope | undefined): AppearanceContext | undefined {
  if (!scope) return undefined;
  const cached = contexts.get(scope);
  if (cached) return cached;

  const context: AppearanceContext = {
    scope,
    resolve(route, tag, props, document) {
      return resolveAppearance(route as AppearanceRoute | undefined, scope, tag, props, document);
    }
  };

  contexts.set(scope, context);
  return context;
}

function extendContext(parent: AppearanceContext | undefined, maps: readonly StyleMap[]) {
  let scope = parent?.scope as StyleScope | undefined;
  for (const map of maps) scope = createStyleScope(scope, map);
  return createContext(scope)!;
}

function style<T extends object>(type: T, rules: StyleMap): T {
  if (entered.has(type)) throw new Error('Cannot add styles after a component has rendered.');

  const maps = styles.get(type);
  if (maps) maps.push(rules);
  else {
    styles.set(type, [rules]);
    registerAppearance(type, (parent) => {
      entered.add(type);
      return extendContext(parent, styles.get(type)!);
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
    return globalContext ||= extendContext(undefined, globals);
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
  const shape = keys.join('\0');
  const cached = scope.routes.get(`${tag}\0${shape}`);
  if (cached) return cached;

  const present = new Set(keys.map((key) => key.slice(1)));
  const selectors: Selector[] = [];

  for (const name of scope.names) {
    if (!present.has(name) || name == tag) continue;
    const rule = scope.rules[name];
    if (!isRule(rule)) continue;
    selectors.push({ bit: selectors.length, name, parameter: typeof rule == 'function', rule });
  }

  const tagRule = scope.rules[tag];
  const route = {
    cache: new Map(),
    scope,
    selectors,
    shape,
    tag: isRule(tagRule) ? tagRule : undefined
  };

  scope.routes.set(`${tag}\0${shape}`, route);
  return route;
}

function resolveAppearance(
  route: AppearanceRoute | undefined,
  scope: StyleScope | undefined,
  tag: string,
  props: Record<string, unknown>,
  document: Document
): { appearance?: ResolvedAppearance; route?: AppearanceRoute } {
  if (!route || route.scope !== scope) route = createAppearanceRoute(scope, tag, props);
  if (!route) return {};

  let mask = 0;
  let cacheable = true;
  const parameters: unknown[] = [];
  const active: Invocation[] = [];

  if (route.tag) active.push({ rule: route.tag });

  for (const selector of route.selectors) {
    const value = props[`_${selector.name}`];
    if (!isPresent(value)) continue;
    if (selector.bit < 31) mask |= 1 << selector.bit;
    else cacheable = false;
    active.push({ rule: selector.rule, value });
    if (selector.parameter) {
      parameters.push(value);
      cacheable &&= isPrimitive(value);
    }
  }

  const key = cacheable ? cacheKey(mask, parameters) : undefined;
  const cached = key === undefined ? undefined : route.cache.get(key);
  if (cached) return { appearance: cached, route };

  const classes: string[] = [];
  const declarations: Declaration = {};
  const nested: StyleMap = {};

  for (const { rule, value } of active)
    expand(typeof rule == 'function' ? rule(value === true ? undefined : value) : rule, classes, declarations, nested, document);

  const childScope = Object.keys(nested).length ? createStyleScope(route.scope, nested) : undefined;
  if (!classes.length && !Object.keys(declarations).length && !childScope) {
    if (key !== undefined && route.cache.size < CACHE_LIMIT) {
      const appearance = {};
      route.cache.set(key, appearance);
      return { appearance, route };
    }
    return { route };
  }

  const canCompile = cacheable && key !== undefined && route.cache.size < CACHE_LIMIT;
  const generated = canCompile && Object.keys(declarations).length
    ? classFor(document, declarations)
    : undefined;
  const appearance: ResolvedAppearance = {
    className: [...classes, generated].filter(Boolean).join(' ') || undefined,
    declarations: generated ? undefined : declarations
  };
  const context = createContext(childScope);
  if (context) appearance.context = context;

  if (canCompile) route.cache.set(key, appearance);
  return { appearance, route };
}

function expand(
  value: Expression,
  classes: string[],
  declarations: Declaration,
  nested: StyleMap,
  document: Document
) {
  if (!value) return;
  if (typeof value == 'string') {
    classes.push(...value.split(/\s+/).filter(Boolean));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => expand(entry, classes, declarations, nested, document));
    return;
  }

  const probe = document.documentElement.style;
  for (const [name, entry] of Object.entries(value)) {
    if (!name.startsWith('--') && !(name in probe) && isRule(entry)) nested[name] = entry;
    else declarations[name] = entry;
  }
}

function classFor(document: Document, declarations: Declaration) {
  const css = serialize(document, declarations);
  let sheet = sheets.get(document);

  if (!sheet) {
    const element = document.createElement('style');
    element.dataset.expressive = 'jsx';
    document.head.append(element);
    sheet = { classes: new Map(), count: 0, element };
    sheets.set(document, sheet);
  }

  const cached = sheet.classes.get(css);
  if (cached) return cached;

  const name = `e${sheet.count++}`;
  sheet.classes.set(css, name);
  sheet.element.sheet!.insertRule(`.${name}{${css}}`);
  return name;
}

function serialize(document: Document, declarations: Declaration) {
  const value = document.createElement('div').style as any;
  applyDeclarations(value, declarations);
  return value.cssText;
}

function cacheKey(mask: number, parameters: readonly unknown[]) {
  return `${mask >>> 0}|${JSON.stringify(parameters.map(primitiveKey))}`;
}

function primitiveKey(value: unknown) {
  return `${typeof value}:${typeof value == 'number' && Object.is(value, -0) ? '-0' : String(value)}`;
}

function isPresent(value: unknown) {
  return value !== false && value !== null && value !== undefined;
}

function isPrimitive(value: unknown) {
  return !['function', 'object', 'symbol'].includes(typeof value);
}

function isRule(value: unknown): value is Rule {
  return typeof value == 'function' || !!value && typeof value == 'object' && !Array.isArray(value);
}

function isObjectRule(value: unknown): value is Declaration {
  return !!value && typeof value == 'object' && !Array.isArray(value);
}

export { CACHE_LIMIT, createAppearanceRoute, createStyleScope, macro, resolveAppearance, style };
export type { AppearanceRoute, StyleMap, StyleScope };
