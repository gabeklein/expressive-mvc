import { ContentView, LayoutBase, Label, TextBase, View, unsetValue } from '@nativescript/core';
import type { Claim, Host, Placed } from '@expressive/jsx';

import { create } from './tags';

interface Virtual {
  kind: 'text' | 'marker' | 'fragment';
  text?: string;
  label?: Label;
}

type Node = View | Virtual;

interface Links {
  parent: Node | null;
  children: Node[];
}

const links = new WeakMap<object, Links>();
const listeners = new WeakMap<View, Map<string, (data: any) => void>>();
const holding = new WeakSet<View>();

function linksOf(node: Node) {
  let found = links.get(node);
  if (!found) links.set(node, (found = { parent: null, children: [] }));
  return found;
}

function owner(node: Node | null): View | null {
  while (node && !(node instanceof View)) node = linksOf(node).parent;
  return node;
}

function views(node: Node, into: View[]) {
  if (node instanceof View) into.push(node);
  else if (node.kind == 'text') into.push(node.label ||= label(node.text!));
  else for (const child of linksOf(node).children) views(child, into);
  return into;
}

function label(text: string) {
  const view = new Label();
  view.text = text;
  return view;
}

function textOf(node: Node): string {
  if (node instanceof View) return '';
  if (node.kind == 'text') return node.text!;
  return linksOf(node).children.map(textOf).join('');
}

function holdsText(node: Node): boolean {
  if (node instanceof View) return false;
  if (node.kind == 'text') return true;
  return linksOf(node).children.some(holdsText);
}

function sync(view: View | null) {
  if (!view) return;

  const children = linksOf(view).children;

  if (view instanceof TextBase) {
    if (children.some(holdsText) || holding.has(view)) {
      holding.add(view);
      view.text = children.map(textOf).join('');
    }
    return;
  }

  const desired = children.flatMap((child) => views(child, []));

  if (view instanceof LayoutBase) {
    desired.forEach((child, index) => {
      if (view.getChildAt(index) === child) return;
      unparent(child);
      view.insertChild(child, index);
    });

    while (view.getChildrenCount() > desired.length)
      view.removeChild(view.getChildAt(desired.length));
  } else if (view instanceof ContentView) {
    if (view.content === desired[0]) return;
    if (desired[0]) unparent(desired[0]);
    view.content = desired[0] || null!;
  }
}

function unparent(view: View) {
  const parent = view.parent;

  if (parent instanceof LayoutBase) parent.removeChild(view);
  else if (parent instanceof ContentView && parent.content === view) parent.content = null!;
}

function detach(node: Node) {
  const { parent } = linksOf(node);
  if (!parent) return;

  const siblings = linksOf(parent).children;
  siblings.splice(siblings.indexOf(node), 1);
  linksOf(node).parent = null;
  sync(owner(parent));
}

function insert(parent: Node, node: Node, before: Node | null) {
  if (!(node instanceof View) && node.kind == 'fragment') {
    for (const child of [...linksOf(node).children]) insert(parent, child, before);
    return;
  }

  detach(node);

  const siblings = linksOf(parent).children;
  const at = before ? siblings.indexOf(before) : -1;

  if (at < 0) siblings.push(node);
  else siblings.splice(at, 0, node);

  linksOf(node).parent = parent;
  sync(owner(parent));
}

function eventName(key: string) {
  return key[2].toLowerCase() + key.slice(3);
}

function rule(previous: Placed, next: Placed) {
  return previous.depth - next.depth || previous.block.ordinal - next.block.ordinal;
}

function resolve(claim: Claim | undefined) {
  const declarations: Record<string, unknown> = {};
  const classes: string[] = [];

  if (!claim) return { classes, declarations };

  const placed = claim.classes.filter((entry): entry is Placed => typeof entry != 'string');

  for (const entry of claim.classes) if (typeof entry == 'string') classes.push(entry);
  for (const { block } of placed.sort(rule)) Object.assign(declarations, block.declarations);
  Object.assign(declarations, claim.declarations);

  return { classes, declarations };
}

const native: Host<Node> = {
  element: (tag) => create(tag),
  text: (value) => ({ kind: 'text', text: value }),
  marker: () => ({ kind: 'marker' }),
  fragment: () => ({ kind: 'fragment' }),

  insert,
  remove: detach,
  parent: (node) => linksOf(node).parent,
  next(node) {
    const { parent } = linksOf(node);
    if (!parent) return null;

    const siblings = linksOf(parent).children;
    return siblings[siblings.indexOf(node) + 1] || null;
  },
  root(node) {
    while (linksOf(node).parent) node = linksOf(node).parent!;
    return node;
  },
  clear(container) {
    for (const child of [...linksOf(container).children]) detach(child);
  },
  setText(node, value) {
    const text = node as Virtual;

    text.text = value;
    if (text.label) text.label.text = value;
    sync(owner(linksOf(node).parent));
  },
  target(into) {
    if (into instanceof View) return into;
    throw new Error('Portal targets must be a view.');
  },

  prop(node, key, previous, next) {
    const view = node as View;

    if (/^on[A-Z]/.test(key)) {
      const name = eventName(key);
      let map = listeners.get(view);
      if (!map) listeners.set(view, (map = new Map()));

      const current = map.get(name);
      if (current) view.off(name, current);

      if (typeof next == 'function') {
        const listener = (data: any) => (next as (data: any) => void)(data);
        map.set(name, listener);
        view.on(name, listener);
      } else map.delete(name);
      return;
    }

    (view as any)[key] = next == null || next === false ? unsetValue : next;
  },

  style(node, previous, next) {
    const view = node as View;
    const before = resolve(previous);
    const after = resolve(next);
    const className = after.classes.join(' ');

    if (before.classes.join(' ') !== className) view.className = className;

    for (const key of Object.keys(before.declarations))
      if (!(key in after.declarations)) (view.style as any)[key] = unsetValue;

    for (const [key, value] of Object.entries(after.declarations))
      if (before.declarations[key] !== value) (view.style as any)[key] = value ?? unsetValue;
  },

  release(node) {
    const view = node as View;

    for (const [name, listener] of listeners.get(view) || []) view.off(name, listener);
    listeners.delete(view);
  }
};

export { native };
