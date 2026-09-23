import { registerAppearance, registerAppearanceRoot, registerEmitter } from './appearance-protocol';
import type { AppearanceContext, Block, Declaration, ResolvedAppearance } from './appearance-protocol';
import { applyDeclarations } from './declarations';

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

interface Site {
  args?: unknown[];
  block?: Block;
  expansion?: Expansion;
  stable?: Declaration;
  version: number;
}

interface AppearanceRoute {
  flags: readonly string[];
  macros: readonly string[];
  scope: StyleScope;
  sites: Map<string, Site>;
  tag?: string;
}

interface Sheet {
  element: HTMLStyleElement;
  emitted: WeakMap<Block, Map<number, string>>;
  names: Map<string, string>;
  positions: [number, number][];
}

const contexts = new WeakMap<StyleScope, AppearanceContext>();
const rootScopes = new WeakMap<object, StyleScope>();
const sheets = new WeakMap<Document, Sheet>();
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
    resolve(route, tag, props, site) {
      return resolveAppearance(route as AppearanceRoute | undefined, scope, tag, props, site);
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
  registerEmitter(emit);
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
  registerEmitter(emit);
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
  const macros: string[] = [];

  for (const name of scope.names) {
    const rule = scope.rules[name];
    if (!present.has(name) || name == tag) continue;
    if (typeof rule == 'function') macros.push(name);
    else if (isObject(rule)) flags.push(name);
  }

  const route: AppearanceRoute = {
    flags,
    macros,
    scope,
    sites: new Map(),
    tag: isObject(scope.rules[tag]) ? tag : undefined
  };

  scope.routes.set(id, route);
  return route;
}

function resolveAppearance(
  route: AppearanceRoute | undefined,
  scope: StyleScope | undefined,
  tag: string,
  props: Record<string, unknown>,
  site = ''
): { appearance?: ResolvedAppearance; route?: AppearanceRoute } {
  if (!route || route.scope !== scope) route = createAppearanceRoute(scope, tag, props);
  if (!route) return {};

  const parts: Expansion[] = [];
  const names = route.tag ? [route.tag] : [];

  for (const name of route.flags)
    if (isPresent(props[`_${name}`])) names.push(name);

  for (const name of names)
    parts.push(expandRule(route.scope, name));

  const inline = locate(route, tag, props, parts, site);
  const blocks = parts.flatMap((part) => part.block ? [part.block] : []);
  const classes = parts.flatMap((part) => part.classes);
  let child: StyleScope | undefined = route.scope;

  for (const part of parts)
    for (const nested of part.nested)
      child = createStyleScope(child, nested, `${route.scope.label}_${tag}`);

  if (!blocks.length && !classes.length && !inline && child === route.scope)
    return { route };

  const appearance: ResolvedAppearance = {};
  if (blocks.length) appearance.blocks = blocks;
  if (classes.length) appearance.classes = classes;
  if (inline) appearance.declarations = inline;
  if (child !== route.scope) appearance.context = createContext(child!);

  return { appearance, route };
}

function locate(
  route: AppearanceRoute,
  tag: string,
  props: Record<string, unknown>,
  parts: Expansion[],
  path: string
) {
  const args = route.macros.map((name) => props[`_${name}`]);
  if (!args.some(isPresent)) return undefined;

  let site = route.sites.get(path);
  if (!site) route.sites.set(path, (site = { version: 0 }));

  if (!site.args || args.some((value, index) => !Object.is(value, site.args![index]))) {
    site.args = args;
    site.expansion = expand(
      route.scope,
      route.macros.map((name, index) => ({ [name]: args[index] })),
      []
    );
  }

  const { declarations } = site.expansion!;
  let inline: Declaration | undefined;

  if (!site.stable) {
    site.stable = { ...declarations };
    site.block = createBlock(route, site, tag, { ...site.stable });
  } else {
    let changed = false;

    for (const key of Object.keys(site.stable))
      if (!Object.is(site.stable[key], declarations[key])) {
        delete site.stable[key];
        changed = true;
      }

    if (changed) {
      site.version++;
      site.block = createBlock(route, site, tag, { ...site.stable });
    }
  }

  for (const key of Object.keys(declarations))
    if (!(key in site.stable)) (inline ||= {})[key] = declarations[key];

  parts.push({ ...site.expansion!, block: site.block });
  return inline;
}

function createBlock(route: AppearanceRoute, site: Site, tag: string, declarations: Declaration): Block | undefined {
  if (!Object.keys(declarations).length) return undefined;

  const { scope, macros } = route;
  const name = `${scope.label}_${tag}-${macros.join('-')}`;

  return {
    declarations,
    name: site.version ? `${name}-v${site.version + 1}` : name,
    ordinal: scope.names.length
  };
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

function emit(block: Block, depth: number, document: Document) {
  let sheet = sheets.get(document);

  if (!sheet?.element.sheet) {
    const element = document.createElement('style');
    element.dataset.expressive = 'jsx';
    document.head.append(element);
    sheet = { element, emitted: new WeakMap(), names: new Map(), positions: [] };
    sheets.set(document, sheet);
  }

  let byDepth = sheet.emitted.get(block);
  if (!byDepth) sheet.emitted.set(block, (byDepth = new Map()));

  const cached = byDepth.get(depth);
  if (cached) return cached;

  const css = serialize(document, block.declarations);
  const base = (depth ? `${block.name}-d${depth}` : block.name).replace(/[^\w-]/g, '_');
  let name = base;

  for (let index = 2; sheet.names.has(name) && sheet.names.get(name) !== css; index++)
    name = `${base}-${index}`;

  if (!sheet.names.has(name)) {
    const { positions } = sheet;
    let at = positions.findIndex(([d, o]) => d > depth || d == depth && o > block.ordinal);
    if (at < 0) at = positions.length;

    sheet.names.set(name, css);
    positions.splice(at, 0, [depth, block.ordinal]);
    sheet.element.sheet!.insertRule(`.${name}{${css}}`, at);
  }

  byDepth.set(depth, name);
  return name;
}

function serialize(document: Document, declarations: Declaration) {
  const value = document.createElement('div').style as any;
  applyDeclarations(value, declarations);
  return value.cssText;
}

function isPresent(value: unknown) {
  return value !== false && value !== null && value !== undefined;
}

function isObject(value: unknown): value is Declaration {
  return !!value && typeof value == 'object' && !Array.isArray(value);
}

export { createAppearanceRoute, createStyleScope, macro, resolveAppearance, style };
export type { AppearanceRoute, StyleMap, StyleScope };
