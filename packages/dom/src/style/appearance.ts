import { createAppearanceToken, isPart, registerAppearance, SUBCOMPONENT } from './protocol';
import type { AppearanceContext, Block, Condition, Declaration, ResolvedAppearance } from './protocol';
import { setRoot } from './root';
import type { Root } from './root';

type StyleMap = Record<string, unknown>;

interface Pack {
  label: string;
  layers: readonly StyleMap[];
  rules: readonly StyleMap[];
}

interface Styles {
  own: StyleMap[];
  pack?: Pack;
  subs: Record<string, StyleMap[]>;
}

type Macro = (value: unknown, key: string) => unknown;
type Chain = Macro[] & { named: number };
type Depths = ReadonlyMap<string, number>;
type Entry = [key: string, body: StyleMap, chain: string[]];

interface Frame {
  group?: Block;
  name: string;
}

interface Variant {
  declarations: Declaration;
  when: string[];
}

interface Expansion {
  blocks: Block[];
  classes: string[];
  declarations: Declaration;
  nested: StyleMap[];
  variants: Variant[];
}

interface StyleScope {
  children: WeakMap<object, StyleScope>;
  expansions: Map<string, Expansion>;
  label: string;
  labels: Record<string, string>;
  local: readonly string[];
  low: Record<string, boolean>;
  macros: StyleMap;
  own: Declaration;
  pack?: Pack;
  routes: Map<string, AppearanceRoute>;
  rules: StyleMap;
}

interface AppearanceRoute {
  flags: readonly string[];
  scope: StyleScope;
  tag?: string;
}

const bases = new WeakMap<StyleScope, Declaration>();
const groups = new WeakMap<StyleScope, Block[]>();
const ownGroups = new WeakMap<StyleScope, Block>();
const ancestors = new Map<string, Condition>();
const chains = new WeakMap<StyleScope, Map<string, Chain>>();
const contexts = new WeakMap<StyleScope, AppearanceContext>();
const rootScopes = new WeakMap<object, StyleScope>();
const STYLES = Symbol('@expressive/dom.styles');
const entered = new WeakSet<object>();
const rooted = new WeakMap<StyleScope, StyleMap>();
const LOW = 2 ** 20;
let parts = 0;

function createStyleScope(parent: StyleScope | undefined, value: unknown, label?: string, pack?: Pack, low?: boolean): StyleScope | undefined {
  if (!isObject(value)) return parent;

  const cache = parent?.children || rootScopes;
  const cached = cache.get(value);
  if (cached) return cached;

  const own: string[] = [];
  const source: StyleMap = {};
  const marked: StyleMap = {};
  const base: Declaration = {};
  const scopeLabel = label || parent?.label || 'style';
  const root: Frame = { name: scopeLabel };
  const defines = pack && !low;
  const macros = defines ? Object.create(parent?.macros || null) as StyleMap : parent?.macros || Object.create(null);

  for (const written of Object.keys(value)) {
    const key = defines ? written : alias(macros, written);
    const entry = flatten((value as StyleMap)[written], key);

    if (SUBCOMPONENT.test(key))
      throw new Error(`Subcomponent "${key}" must be at the top of a style() map.`);

    if (defines && key[0] == '$') macros[key] = entry;
    else if (key[0] == '_') {
      if (!isObject(entry))
        throw new Error(`Rule "${key}" must be an object. Macros are defined on a Style class.`);

      if (isPart(key)) {
        marked[key] = merge(marked[key], entry);
        continue;
      }

      const name = key.slice(1);
      if (!own.includes(name)) own.push(name);
      source[name] = merge(source[name], entry);
    } else if (isCondition(key) && isObject(entry)) {
      base[key] = merge(base[key], lift(root, split(macros, key).map((when) => [when]), entry, own, source, marked, macros));
    } else if (defines && typeof entry == 'function') macros[key] = entry;
    else base[key] = entry;
  }

  const before = parent ? parent.local : [];
  const local = [...before, ...own.filter((name) => !before.includes(name))];
  const rules = Object.create(parent?.rules || null) as StyleMap;
  const labels = Object.create(parent?.labels || null) as Record<string, string>;
  const lows = Object.create(parent?.low || null) as Record<string, boolean>;

  for (const name of own) {
    lows[name] = !!low;
    const rule = source[name];
    const inherited = parent?.rules[name] as StyleMap | undefined;
    rules[name] = inherited ? mergeRule(inherited, rule as StyleMap) : rule;
    labels[name] = scopeLabel;
  }

  const scope: StyleScope = {
    children: new WeakMap(),
    expansions: new Map(),
    label: scopeLabel,
    labels,
    local,
    low: lows,
    macros,
    own: base,
    pack: pack || parent?.pack,
    routes: new Map(),
    rules
  };

  anchor(scope, root, marked, !low);
  if (root.group) ownGroups.set(scope, root.group);

  cache.set(value, scope);
  return scope;
}

function lift(frame: Frame, paths: string[][], body: StyleMap, own: string[], source: StyleMap, marked: StyleMap, macros: StyleMap) {
  const rest: StyleMap = {};

  for (const written of Object.keys(body)) {
    const key = alias(macros, written);
    const entry = flatten(body[written], key);

    if (key[0] == '_') {
      const part = isPart(key);
      const name = part ? key : key.slice(1);
      const sink = part ? marked : source;
      if (!part && !own.includes(name)) own.push(name);

      for (const path of paths)
        sink[name] = merge(sink[name], path.reduceRight<StyleMap>(
          (rule, when) => ({ [hoist(frame, when)]: rule }),
          entry as StyleMap
        ));
    } else if (isCondition(key) && isObject(entry)) {
      const inner = paths.flatMap((path) => split(macros, key).map((when) => [...path, when]));
      rest[key] = lift(frame, inner, entry, own, source, marked, macros);
    } else rest[key] = entry;
  }

  return rest;
}

function createContext(scope: StyleScope): AppearanceContext {
  const cached = contexts.get(scope);
  if (cached) return cached;

  const context: AppearanceContext = {
    scope,
    base: baseToken(scope),
    resolve(props, tag) {
      return resolveAppearance(scope, props, tag);
    }
  };

  contexts.set(scope, context);
  return context;
}

function extendContext(parent: AppearanceContext | undefined, maps: readonly StyleMap[], label: string, pack?: Pack, low?: boolean) {
  if (!maps.length) return parent;

  let scope = parent?.scope as StyleScope | undefined;
  const base: Declaration = { ...(scope && bases.get(scope)) };
  const anchors = new Set(scope && groups.get(scope));

  for (const map of maps) {
    scope = createStyleScope(scope, map, label, pack, low);

    const declarations = low ? hoistRoot(scope!) : scope!.own;
    const loose = low && declared(declarations);

    if (loose)
      throw new Error(`Pack rules must be _rules; "${loose}" would style every root.`);

    Object.assign(base, mergeRule(base, declarations));
    const own = ownGroups.get(scope!);
    if (own) anchors.add(own);
  }

  if (Object.keys(base).length) bases.set(scope!, base);
  if (anchors.size) groups.set(scope!, [...anchors]);

  return createContext(scope!);
}

function hoistRoot(scope: StyleScope) {
  let own = rooted.get(scope);

  if (!own) {
    const roots: Root[] = [];

    rooted.set(scope, (own = strip(scope.macros, scope.own, [], roots)));
    if (roots.some((root) => Object.keys(root.declarations).length)) setRoot(scope, roots);
  }

  return own;
}

function strip(macros: StyleMap, map: StyleMap, when: readonly string[], roots: Root[]) {
  const rest: StyleMap = {};
  const declarations: Declaration = {};

  roots.push({ declarations, when });

  for (const key of Object.keys(map)) {
    const entry = map[key];

    if (key.startsWith('--')) declarations[key] = entry;
    else if (isCondition(key) && isObject(entry))
      rest[key] = strip(macros, entry, [...when, condition(macros, key)], roots);
    else rest[key] = entry;
  }

  return rest;
}

function baseToken(scope: StyleScope) {
  const base = bases.get(scope);
  const anchors = groups.get(scope);
  if (!base && !anchors) return undefined;

  const frame: Frame = { name: scope.label };
  const expansion = expand(scope, base, new Map(), frame);
  const blocks = [...toBlocks(expansion, frame, -0.5), ...anchors || []];
  const appearance: ResolvedAppearance = {};

  if (blocks.length) appearance.blocks = blocks;

  if (expansion.classes.length) appearance.classes = expansion.classes;

  return createAppearanceToken(appearance);
}

function style<T extends object>(type: T, rules: StyleMap, pack?: Pack): T {
  if (entered.has(type)) throw new Error('Cannot add styles after a component has rendered.');

  if (!Object.hasOwn(type, STYLES)) {
    const name = label(type);

    Object.defineProperty(type, STYLES, { configurable: true, value: { own: [], subs: {} } });
    registerAppearance(type, (parent, key, defines) => {
      const { own, pack, subs } = (type as any)[STYLES] as Styles;
      entered.add(type);

      const maps = key ? defines && subs[key] : own;

      if (pack && (parent?.scope as StyleScope | undefined)?.pack !== pack)
        parent = extendContext(
          extendContext(parent, pack.layers, name, pack),
          pack.rules,
          pack.label,
          pack,
          true
        );

      return maps ? extendContext(parent, maps, key ? `${name}_${key}` : name) : parent;
    });
  }

  const styles = (type as any)[STYLES] as Styles;
  const rest: StyleMap = {};

  if (pack && styles.pack && styles.pack !== pack)
    throw new Error(`"${label(type)}" is already styled by another pack.`);

  styles.pack ||= pack;

  for (const key of Object.keys(rules))
    if (SUBCOMPONENT.test(key)) {
      const body = flatten(rules[key], key);

      const name = key.slice(1);

      if (!isObject(body))
        throw new Error(`Subcomponent "${key}" must be an object.`);

      if (!Object.hasOwn(Object((type as Function).prototype), name))
        throw new Error(
          `Subcomponent "${key}" styles only a ${name}() method defined on ${label(type)}. ` +
          `Override ${name}() there, or have the owner put a rule on the element - <this.${name} _rule /> - and style that rule.`
        );

      (styles.subs[name] ||= []).push(body);
    } else rest[key] = rules[key];

  styles.own.push(rest);
  return type;
}

function createAppearanceRoute(
  scope: StyleScope | undefined,
  props: Record<string, unknown>,
  tag?: string
): AppearanceRoute | undefined {
  if (!scope) return undefined;

  const keys = Object.keys(props).filter((key) => key[0] == '_' && key[1] != '_').sort();
  const id = `${tag || ''}\0${keys.join('\0')}`;
  const cached = scope.routes.get(id);
  if (cached) return cached;

  const present = new Set(keys.map((key) => key.slice(1)));
  const flags: string[] = [];

  for (const name of scope.local)
    if (present.has(name) && name != tag) flags.push(name);

  const route: AppearanceRoute = {
    flags,
    scope,
    tag: tag && scope.rules[tag] ? tag : undefined
  };

  scope.routes.set(id, route);
  return route;
}

function resolveAppearance(
  scope: StyleScope | undefined,
  props: Record<string, unknown>,
  tag?: string
): ResolvedAppearance | undefined {
  const route = createAppearanceRoute(scope, props, tag);

  if (!route) return undefined;

  const parts: Expansion[] = [];
  const names: string[] = route.tag ? [route.tag] : [];

  for (const name of route.flags)
    if (props[`_${name}`]) names.push(name);

  for (const name of names)
    parts.push(expandRule(route.scope, name));

  const blocks = parts.flatMap((part) => part.blocks);
  const classes = parts.flatMap((part) => part.classes);
  let child: StyleScope | undefined = route.scope;

  for (const part of parts)
    for (const nested of part.nested)
      child = createStyleScope(child, nested, tag ? `${route.scope.label}_${tag}` : route.scope.label);

  if (!blocks.length && !classes.length && child === route.scope)
    return undefined;

  const appearance: ResolvedAppearance = {};
  if (blocks.length) appearance.blocks = blocks;
  if (classes.length) appearance.classes = classes;
  if (child !== route.scope) appearance.context = createContext(child!);

  return appearance;
}

function expandRule(scope: StyleScope, name: string) {
  let expansion = scope.expansions.get(name);

  if (!expansion) {
    const frame: Frame = { name: `${scope.labels[name]}_${name}` };
    const marked: StyleMap = {};
    expansion = expand(scope, scope.rules[name], new Map(), frame);

    const [nested] = expansion.nested;

    for (const key of Object.keys(nested || {}))
      if (isPart(key)) {
        marked[key] = nested[key];
        delete nested[key];
      }

    if (nested && !Object.keys(nested).length) expansion.nested = [];

    anchor(scope, frame, marked, true);
    const index = scope.local.indexOf(name);
    expansion.blocks = toBlocks(expansion, frame, scope.low[name] ? index - LOW : index);

    scope.expansions.set(name, expansion);
  }

  return expansion;
}

function toBlocks({ declarations, variants }: Expansion, { group, name }: Frame, ordinal: number) {
  const blocks: Block[] = [];

  if (Object.keys(declarations).length) blocks.push({ declarations, name, ordinal });

  for (const { declarations, when } of variants)
    blocks.push({
      declarations,
      name,
      ordinal: ordinal + 0.5 - 0.25 / when.length,
      when: when.map((condition) => ancestors.get(condition) || condition)
    });

  if (group) blocks.push(group);

  return blocks;
}

function hoist(frame: Frame, condition: string) {
  if (condition[0] != ':') return condition;

  if (condition.includes('::'))
    throw new Error(`Rules cannot nest inside pseudo-element "${condition}".`);

  const key = `\0${ancestors.size}`;
  ancestors.set(key, { on: group(frame), state: condition });
  return key;
}

function group(frame: Frame) {
  return frame.group ||= { declarations: {}, group: true, name: frame.name, ordinal: 0 };
}

function anchor(scope: StyleScope, frame: Frame, marked: StyleMap, scoped: boolean) {
  const entries = Object.keys(marked).map<Entry>((key) => [key, marked[key] as StyleMap, []]);

  if (entries.length) {
    const on = group(frame);
    on.parts = partBlocks(scope, entries, frame.name, scoped ? on : undefined);
  }
}

function partBlocks(scope: StyleScope, entries: Entry[], label: string, anchor: Block | undefined): Block[] {
  const blocks: Block[] = [];

  for (const [key, body, chain] of entries) {
    const nested: Entry[] = [];
    const frame: Frame = { name: label + key };
    const expansion = expand(scope, partition(scope.macros, body, key, chain, [], [], nested), new Map(), frame);

    if (expansion.classes.length)
      throw new Error(`Classes are not supported in part "${key}".`);

    for (const block of toBlocks(expansion, frame, LOW + parts++))
      blocks.push({ ...block, part: { anchor, chain, name: key.slice(2) } });

    blocks.push(...partBlocks(scope, nested, frame.name, anchor));
  }

  return blocks;
}

function partition(macros: StyleMap, body: StyleMap, key: string, chain: string[], states: string[], wrap: string[], nested: Entry[]) {
  const own: StyleMap = {};

  for (const written of Object.keys(body)) {
    const name = alias(macros, written);
    const entry = flatten(body[written], name);

    if (name[0] == '_') {
      if (!isPart(name))
        throw new Error(`Rule "${name}" cannot apply inside part "${key}".`);

      const pseudo = states.find((state) => state.includes('::'));

      if (pseudo)
        throw new Error(`Parts cannot nest inside pseudo-element "${pseudo}".`);

      if (isObject(entry))
        nested.push([
          name,
          wrap.reduceRight<StyleMap>((rule, when) => ({ [when]: rule }), entry),
          [...chain, `:where(:is(.${key}, ${key.slice(2)})${states.join('')})`]
        ]);
    } else if (isCondition(name) && isObject(entry))
      for (const when of split(macros, name))
        own[name] = when[0] == ':'
          ? partition(macros, entry, key, chain, [...states, when], wrap, nested)
          : partition(macros, entry, key, chain, states, [...wrap, when], nested);
    else own[name] = entry;
  }

  return own;
}

function handlers(scope: StyleScope, name: string) {
  let known = chains.get(scope);
  if (!known) chains.set(scope, (known = new Map()));

  let chain = known.get(name);

  if (!chain) {
    chain = Object.assign([], { named: 0 });

    for (const key of [name, 'default']) {
      for (let macros: object | null = scope.macros; macros; macros = Object.getPrototypeOf(macros)) {
        const own = Object.getOwnPropertyDescriptor(macros, key);
        if (own) chain.push(own.value as Macro);
      }

      if (key == name) chain.named = chain.length;
    }

    known.set(name, chain);
  }

  return chain;
}

function expand(scope: StyleScope, value: unknown, depths: Depths, frame: Frame): Expansion {
  const output: Expansion = { blocks: [], classes: [], declarations: {}, nested: [], variants: [] };
  const nested: StyleMap = {};
  const conditions: [string, StyleMap][] = [];

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

    for (const [written, raw] of Object.entries(value as Declaration)) {
      const name = alias(scope.macros, written);
      const entry = flatten(raw, name);

      if (name[0] == '_') {
        if (isObject(entry)) nested[name] = merge(nested[name], entry);
        continue;
      }

      if (isCondition(name)) {
        if (isObject(entry)) conditions.push([name, entry]);
        else if (isPresent(entry)) throw new Error(`Condition "${name}" must be an object.`);
        continue;
      }

      if (name == 'default')
        throw new Error('"default" is not a style key.');

      const chain = handlers(scope, name);
      const depth = depths.get(name) || 0;

      if (depth && depth >= chain.named && entry === true)
        throw new Error(`Macro "${name}" returned itself.`);

      if (depth < chain.length) {
        if (isPresent(entry))
          walk(
            chain[depth](entry === true ? undefined : entry, name),
            new Map(depths).set(name, depth + 1)
          );
      } else {
        if (typeof entry == 'string' && typeof scope.macros[entry] == 'string')
          throw new Error(`Condition "${entry}" is not a value of "${name}".`);

        output.declarations[name] = terminal(name, entry);
      }
    }
  }

  walk(value, depths);

  for (const [key, body] of conditions)
    for (const when of split(scope.macros, key)) {
      const inner = expand(scope, body, depths, frame);

      if (inner.classes.length)
        throw new Error(`Classes are not supported inside "${when}".`);

      for (const map of inner.nested) {
        const key = hoist(frame, when);

        for (const rule of Object.keys(map))
          nested[rule] = merge(nested[rule], { [key]: map[rule] });
      }

      if (Object.keys(inner.declarations).length)
        output.variants.push({ declarations: inner.declarations, when: [when] });

      for (const variant of inner.variants)
        output.variants.push({ declarations: variant.declarations, when: [when, ...variant.when] });
    }

  if (Object.keys(nested).length) output.nested.push(nested);
  return output;
}

function terminal(name: string, value: unknown) {
  if (Array.isArray(value)) return value.join(' ');

  if (value === true || typeof value == 'function' || isObject(value))
    throw new Error(`No macro handles "${name}".`);

  return typeof value == 'number' ? String(value) : value;
}

function isCondition(key: string) {
  return key[0] == ':' || key[0] == '@' || key[0] == '$' || key[0] == '\0';
}

function alias(macros: StyleMap, key: string) {
  const value = key[0] == '$' && macros[key];

  return typeof value == 'string' && value.startsWith('--') ? value : key;
}

function condition(macros: StyleMap, key: string) {
  if (key[0] != '$') return key;

  const value = macros[key];

  if (typeof value != 'string')
    throw new Error(`Unknown condition "${key}".`);

  return value;
}

function split(macros: StyleMap, key: string) {
  key = condition(macros, key);

  if (key[0] != ':') return [key];

  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < key.length; index++) {
    const char = key[index];

    if (char == '(') depth++;
    else if (char == ')') depth--;
    else if (char == ',' && !depth) {
      parts.push(key.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(key.slice(start).trim());
  return parts;
}

function merge(left: unknown, right: StyleMap): StyleMap {
  return isObject(left) ? mergeRule(left, right) : right;
}

function mergeRule(left: StyleMap, right: StyleMap): StyleMap {
  const output = { ...left, ...right };

  for (const key of Object.keys(right)) {
    if (key[0] != '_' && !isCondition(key)) continue;

    const before = flatten(left[key], key);
    const after = flatten(right[key], key);

    if (isObject(before) && isObject(after))
      output[key] = mergeRule(before, after);
  }

  return output;
}

function flatten(value: unknown, key: string): unknown {
  if (!Array.isArray(value) || key[0] != '_' && !isCondition(key)) return value;

  let output: StyleMap = {};

  for (const entry of value) {
    const map = flatten(entry, key);

    if (isObject(map)) output = mergeRule(output, map);
    else if (isPresent(map)) return map;
  }

  return output;
}

function declared(map: StyleMap): string | undefined {
  for (const key of Object.keys(map)) {
    const entry = map[key];

    if (isObject(entry) ? declared(entry) : isPresent(entry)) return key;
  }
}

function label(type: object) {
  return (type as { displayName?: string }).displayName || (type as Function).name;
}

function isPresent(value: unknown) {
  return value !== false && value !== null && value !== undefined;
}

function isObject(value: unknown): value is Declaration {
  return !!value && typeof value == 'object' && !Array.isArray(value);
}

export { createAppearanceRoute, createStyleScope, resolveAppearance, style };
export type { AppearanceRoute, Pack, StyleMap, StyleScope };
