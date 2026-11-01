import { Component, Context, Model } from '@expressive/mvc';
import { host } from '@expressive/mvc/jsx-runtime';
import { beforeEach, describe, expect, it } from 'vitest';

import { flushMicrotasks, mockPromise } from '../test.setup';
import { attach, find, health, Instance, instances, models, orphans } from './index';
import { collected } from './inspect';

host({
  childrenOf: () => [],
  isElement: () => false,
  jsx: () => null,
  jsxs: () => null,
  propsOf: () => ({}),
  typeOf: () => null,
  Fragment: null
});

class Widget extends Model {
  value = 1;
}

class Plain extends Model {
  value = 1;
}

class Owner extends Model {
  child = new Plain();
}

class Scoped extends Model {
  value = 1;
}

class Held extends Model {
  value = 1;
}

describe('orphans under a host', () => {
  beforeEach(() => void attach());

  it('will keep a fresh instance on the mainline until it settles', async () => {
    const plain = Plain.new();
    expect(models().length).toBe(1);
    expect(Instance.of(plain).claimed).toBe(true);
    await flushMicrotasks();
    expect(models()).toEqual([]);
    expect(orphans().map((o) => o.id)).toEqual([String(plain)]);
    expect(Instance.of(plain).claimed).toBe(false);
    expect(health()).toMatchObject({ orphans: 1, collected: 0 });
  });

  it('will claim a held instance once it is ready', async () => {
    const placed = mockPromise<void>();
    const widget = Widget.new(() => placed);
    await flushMicrotasks();
    expect(orphans().length).toBe(1);
    placed.resolve();
    await flushMicrotasks();
    expect(orphans()).toEqual([]);
    expect(instances().map((i) => i.id)).toEqual([String(widget)]);
  });

  it('will not hold an instance destroyed before it settles', async () => {
    const placed = mockPromise<void>();
    const plain = Plain.new(() => placed);
    plain.set(null);
    await flushMicrotasks();
    expect(Instance.of(plain).alive).toBe(false);
    expect(Instance.of(plain).claimed).toBe(false);
  });

  it('will claim once an instance held in root and placed', async () => {
    const placed = mockPromise<void>();
    const held = Held.new(Context.root, () => placed);
    await flushMicrotasks();
    expect(orphans()).toEqual([]);
    expect(Instance.of(held).claimed).toBe(true);
    placed.resolve();
    await flushMicrotasks();
    expect(Instance.of(held).claimed).toBe(true);
    Context.root.pop();
  });

  it('will claim a Component providing for', async () => {
    const placed = mockPromise<void>();
    const stop = Component.on({ setup: () => placed });
    const provider = Component.new({ for: Widget } as any);
    stop();
    await flushMicrotasks();
    expect(Instance.of(provider).claimed).toBe(false);
    placed.resolve();
    await flushMicrotasks();
    expect(Instance.of(provider).claimed).toBe(true);
  });

  it('will claim owned children and instances held in root', async () => {
    const owner = Owner.new();
    const held = Held.new(Context.root);
    await flushMicrotasks();
    expect(orphans().map((o) => o.id)).toEqual([String(owner), String(owner.child)]);
    expect(Instance.of(held).claimed).toBe(true);

    const scoped = Context.root.push(Scoped);
    await flushMicrotasks();
    expect(orphans().length).toBe(3);
    scoped.pop();
    Context.root.pop();
  });

  it('will orphan the children of an orphan, and claim them with a placed owner', async () => {
    const placed = mockPromise<void>();
    const owner = Owner.new(() => placed);
    await flushMicrotasks();
    expect(orphans().map((o) => o.type)).toEqual(['Owner', 'Plain']);
    expect(Instance.of(owner.child).claimed).toBe(false);
    placed.resolve();
    await flushMicrotasks();
    expect(orphans()).toEqual([]);
    expect(Instance.of(owner.child).claimed).toBe(true);
  });

  it('will ride along with a young owner without claiming', async () => {
    const early = Plain.new();
    await flushMicrotasks();
    class Late extends Model {
      taken = early;
    }
    const late = Late.new();
    expect(Instance.of(early).claimed).toBe(true);
    expect(orphans()).toEqual([]);
    await flushMicrotasks();
    expect(orphans().map((o) => o.id)).toEqual([String(early), String(late)]);
  });

  it('will not loop on cyclic ownership', async () => {
    class Loop extends Model {
      other?: Loop = undefined;
    }
    const a = Loop.new();
    const b = Loop.new();
    a.other = b;
    b.other = a;
    await flushMicrotasks();
    expect(orphans().length).toBe(2);
  });

  it('will still find an orphan by label after the mainline', async () => {
    const orphan = Plain.new();
    await flushMicrotasks();
    const owner = Owner.new();
    expect(find('Plain')!.id).toBe(String(owner.child));
    expect(find(String(orphan))!.id).toBe(String(orphan));
    expect(find(String(owner.child))!.id).toBe(String(owner.child));
    Widget.new();
    await flushMicrotasks();
    expect(find('Widget')!.claimed).toBe(false);
    expect(find('Owner')!.id).toBe(String(owner));
    expect(find('Nope')).toBeUndefined();
  });

  it('will count an unclaimed instance the collector reaped', async () => {
    const plain = Plain.new();
    await flushMicrotasks();
    collected(String(plain));
    collected(String(plain));
    expect(health()).toMatchObject({ orphans: 0, collected: 1 });
    expect(Instance.of(plain).alive).toBe(false);
  });
});
