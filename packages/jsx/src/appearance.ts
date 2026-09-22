import { applyDeclarations } from './declarations';
import type { Declaration } from './declarations';

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

interface ResolvedAppearance {
  className?: string;
  declarations?: Declaration;
}

interface AppearanceAdapter {
  createScope(parent: unknown, type: unknown): unknown;
  resolve(
    route: unknown,
    scope: unknown,
    tag: string,
    props: Record<string, unknown>,
    document: Document
  ): { appearance?: ResolvedAppearance; route?: unknown };
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
const rootScopes = new WeakMap<object, StyleScope>();
const sheets = new WeakMap<Document, Sheet>();

function createStyleScope(parent: StyleScope | undefined, value: unknown): StyleScope | undefined {
  if (!value || typeof value != 'object' || Array.isArray(value)) return parent;

  const cache = parent?.children || rootScopes;
  const cached = cache.get(value);
  if (cached) return cached;

  const own = Object.keys(value);
  const replaced = new Set(own);
  const names = parent
    ? [...parent.names.filter((name) => !replaced.has(name)), ...own]
    : own;
  const rules = Object.assign(Object.create(parent?.rules || null), value) as StyleMap;

  const scope = {
    children: new WeakMap(),
    names,
    routes: new Map(),
    rules
  };

  cache.set(value, scope);
  return scope;
}

function styleOf(value: unknown): unknown {
  return typeof value == 'function' ? (value as { style?: unknown }).style : undefined;
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

    selectors.push({
      bit: selectors.length,
      name,
      parameter: typeof rule == 'function',
      rule
    });
  }

  const tagRule = scope.rules[tag];
  const resolvedTag = isRule(tagRule) ? tagRule : undefined;

  const route = {
    cache: new Map(),
    scope,
    selectors,
    shape,
    tag: resolvedTag
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

  for (const { rule, value } of active) {
    expand(typeof rule == 'function' ? rule(value === true ? undefined : value) : rule, classes, declarations);
  }

  if (!classes.length && !Object.keys(declarations).length) {
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

  if (canCompile) route.cache.set(key, appearance);
  return { appearance, route };
}

function expand(value: Expression, classes: string[], declarations: Declaration) {
  if (!value) return;
  if (typeof value == 'string') {
    classes.push(...value.split(/\s+/).filter(Boolean));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => expand(entry, classes, declarations));
    return;
  }
  Object.assign(declarations, value);
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
  const style = document.createElement('div').style as any;
  applyDeclarations(style, declarations);
  return style.cssText;
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

const appearance: AppearanceAdapter = {
  createScope(parent, type) {
    return createStyleScope(parent as StyleScope | undefined, styleOf(type));
  },
  resolve(route, scope, tag, props, document) {
    return resolveAppearance(
      route as AppearanceRoute | undefined,
      scope as StyleScope | undefined,
      tag,
      props,
      document
    );
  }
};

export {
  CACHE_LIMIT,
  appearance,
  createAppearanceRoute,
  createStyleScope,
  resolveAppearance,
  styleOf
};

export type { AppearanceAdapter, AppearanceRoute, ResolvedAppearance, StyleScope };
