// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Model, map } from '@expressive/mvc';

import { dom } from '../dom/host';
import { Portal } from '../node/vnode';
import { style } from '../style/stylesheet';
import type { Claim, Placed } from '../style/claim';
import { flushMicrotasks, lazy } from '../../test.setup';
import { install } from './host';
import type { Host } from './host';
import { render } from './render';

interface Item {
  kind: 'element' | 'text' | 'marker' | 'fragment';
  tag?: string;
  text?: string;
  props: Record<string, unknown>;
  styles: Record<string, unknown>;
  parent: Item | null;
  children: Item[];
}

function item(kind: Item['kind'], extra: Partial<Item> = {}): Item {
  return { kind, props: {}, styles: {}, parent: null, children: [], ...extra };
}

function detach(node: Item) {
  if (!node.parent) return;
  node.parent.children.splice(node.parent.children.indexOf(node), 1);
  node.parent = null;
}

function resolve(claim: Claim) {
  const placed = claim.classes.filter((entry): entry is Placed => typeof entry != 'string');
  const output: Record<string, unknown> = {};

  placed.sort((a, b) => a.depth - b.depth || a.block.ordinal - b.block.ordinal);
  for (const { block } of placed) Object.assign(output, block.declarations);
  return Object.assign(output, claim.declarations);
}

const memory: Host<Item> = {
  element: (tag) => item('element', { tag }),
  text: (text) => item('text', { text }),
  marker: () => item('marker'),
  fragment: () => item('fragment'),

  insert(parent, node, before) {
    if (node.kind == 'fragment') {
      for (const child of [...node.children]) memory.insert(parent, child, before);
      return;
    }

    detach(node);
    const at = before ? parent.children.indexOf(before) : -1;
    if (at < 0) parent.children.push(node);
    else parent.children.splice(at, 0, node);
    node.parent = parent;
  },
  remove: detach,
  parent: (node) => node.parent,
  next: (node) => node.parent && node.parent.children[node.parent.children.indexOf(node) + 1] || null,
  root(node) {
    while (node.parent) node = node.parent;
    return node;
  },
  clear(container) {
    for (const child of [...container.children]) detach(child);
  },
  setText(node, value) {
    node.text = value;
  },
  target(into) {
    return into as Item;
  },
  prop(element, key, _previous, next) {
    if (next == null) delete element.props[key];
    else element.props[key] = next;
  },
  style(element, _previous, next) {
    element.styles = resolve(next);
  }
};

function print(node: Item): string {
  const inner = () => node.children.map(print).join('');

  if (node.kind == 'text') return node.text!;
  if (node.kind != 'element') return inner();

  const styles = Object.entries(node.styles).map(([key, value]) => ` ${key}=${value}`).join('');
  return `<${node.tag}${styles}>${inner()}</${node.tag}>`;
}

declare module '../jsx-runtime' {
  interface Tags {
    box: Record<string, unknown>;
    card: Record<string, unknown>;
    done: Record<string, unknown>;
    host: Record<string, unknown>;
    list: Record<string, unknown>;
    moved: Record<string, unknown>;
    wait: Record<string, unknown>;
  }
}

beforeAll(() => install(memory));
afterAll(() => install(dom));

describe('host', () => {
  it('will run without a DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it('will mount and update a Model', async () => {
    class Counter extends Model {
      count = 0;

      render() {
        return <box>Count: {this.count}</box>;
      }
    }

    const root = item('element', { tag: 'root' });
    let counter!: Counter;

    render(<Counter is={(value) => (counter = value)} />, root);
    expect(print(root)).toBe('<root><box>Count: 0</box></root>');

    counter.count = 2;
    await flushMicrotasks();
    expect(print(root)).toBe('<root><box>Count: 2</box></root>');
  });

  it('will add, move and remove collection rows', async () => {
    class List extends Model {
      rows = map<number, string>();

      render() {
        return <list>{this.rows}</list>;
      }
    }

    const root = item('element', { tag: 'root' });
    let list!: List;

    render(<List is={(value) => { list = value; }} />, root);
    list.rows.set(1, 'a').set(2, 'b');
    await flushMicrotasks();
    expect(print(root)).toBe('<root><list>ab</list></root>');

    list.rows.set(3, 'c');
    list.rows.delete(1);
    await flushMicrotasks();
    expect(print(root)).toBe('<root><list>bc</list></root>');
  });

  it('will show a fallback and reveal content', async () => {
    const [Lazy, loaded] = lazy();

    class Boundary extends Model {}

    const root = item('element', { tag: 'root' });

    render(
      <Boundary fallback={<wait />}>
        <Lazy />
      </Boundary>,
      root
    );
    expect(print(root)).toBe('<root><wait></wait></root>');

    loaded.resolve(() => <done />);
    await flushMicrotasks();
    expect(print(root)).toBe('<root><done></done></root>');
  });

  it('will apply rules in order under inline style', () => {
    class Card extends Model {
      render() {
        return <card _accent style={{ color: 'blue' }} />;
      }
    }

    style(Card, {
      padding: '4',
      _accent: { color: 'red', margin: '2' }
    });

    const root = item('element', { tag: 'root' });

    render(<Card />, root);
    expect(print(root)).toBe('<root><card padding=4 color=blue margin=2></card></root>');
  });

  it('will portal into another node', () => {
    const outside = item('element', { tag: 'outside' });
    const root = item('element', { tag: 'root' });

    render(
      <host>
        <Portal into={outside}>
          <moved />
        </Portal>
      </host>,
      root
    );

    expect(print(root)).toBe('<root><host></host></root>');
    expect(print(outside)).toBe('<outside><moved></moved></outside>');
  });
});
