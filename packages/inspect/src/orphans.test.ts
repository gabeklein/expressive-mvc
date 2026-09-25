import { Context, State } from '@expressive/mvc';
import { host } from '@expressive/mvc/runtime';
import { describe, expect, it } from 'vitest';

import { flushMicrotasks } from '../test.setup';
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

class Widget extends State {
  value = 1;
  mounted = 0;

  mount() {
    this.mounted++;
    return 'release';
  }
}

class Plain extends State {
  value = 1;
}

class Owner extends State {
  child = new Plain();
}

class Scoped extends State {
  static global = true;
  value = 1;
}

class Global extends State {
  static global = true;
  value = 1;
}

class Resolved extends State {
  static global = (self: Resolved) => self.value > 0;
  value = 1;
}

describe('orphans under a host', () => {
  it('will keep a fresh instance on the mainline until it settles', async () => {
    attach();
    const plain = Plain.new();
    expect(models().length).toBe(1);
    expect(Instance.of(plain).claimed).toBe(true);
    await flushMicrotasks();
    expect(models()).toEqual([]);
    expect(orphans().map((o) => o.id)).toEqual([String(plain)]);
    expect(Instance.of(plain).claimed).toBe(false);
    expect(health()).toMatchObject({ orphans: 1, collected: 0 });
  });

  it('will claim on host mount and forward the original', async () => {
    attach();
    const widget = Widget.new();
    await flushMicrotasks();
    expect(orphans().length).toBe(1);
    expect(widget.mount()).toBe('release');
    expect(widget.mounted).toBe(1);
    expect(orphans()).toEqual([]);
    expect(instances().map((i) => i.id)).toEqual([String(widget)]);
    widget.mount();
    expect(widget.mounted).toBe(2);
  });

  it('will claim a mounted instance without its own mount', async () => {
    attach();
    const plain = Plain.new() as Plain & { mount(): unknown };
    await flushMicrotasks();
    expect(plain.mount()).toBeUndefined();
    expect(Instance.of(plain).claimed).toBe(true);
  });

  it('will claim owned children and root-provided globals', async () => {
    attach();
    const owner = Owner.new();
    const global = Global.new();
    const resolved = Resolved.new();
    await flushMicrotasks();
    expect(orphans().map((o) => o.id)).toEqual([String(owner), String(owner.child)]);
    expect(Instance.of(global).claimed).toBe(true);
    expect(Instance.of(resolved).claimed).toBe(true);

    const scoped = new Context(Context.root);
    scoped.set(Scoped);
    await flushMicrotasks();
    expect(orphans().length).toBe(3);
    scoped.pop();
    Context.root.pop();
  });

  it('will orphan the children of an orphan, and claim them with a mounted owner', async () => {
    attach();
    const owner = Owner.new() as Owner & { mount(): void };
    await flushMicrotasks();
    expect(orphans().map((o) => o.type)).toEqual(['Owner', 'Plain']);
    expect(Instance.of(owner.child).claimed).toBe(false);
    owner.mount();
    expect(orphans()).toEqual([]);
    expect(Instance.of(owner.child).claimed).toBe(true);
  });

  it('will ride along with a young owner without claiming', async () => {
    attach();
    const early = Plain.new();
    await flushMicrotasks();
    class Late extends State {
      taken = early;
    }
    const late = Late.new();
    expect(Instance.of(early).claimed).toBe(true);
    expect(orphans()).toEqual([]);
    await flushMicrotasks();
    expect(orphans().map((o) => o.id)).toEqual([String(early), String(late)]);
  });

  it('will not loop on cyclic ownership', async () => {
    class Loop extends State {
      other?: Loop = undefined;
    }
    attach();
    const a = Loop.new();
    const b = Loop.new();
    a.other = b;
    b.other = a;
    await flushMicrotasks();
    expect(orphans().length).toBe(2);
  });

  it('will still find an orphan by label after the mainline', async () => {
    attach();
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

  it('will ignore a mount after destruction', async () => {
    attach();
    const plain = Plain.new() as Plain & { mount(): unknown };
    plain.set(null);
    expect(plain.mount()).toBeUndefined();
    expect(Instance.of(plain).alive).toBe(false);
    expect(Instance.of(plain).claimed).toBe(true);
  });

  it('will count an unclaimed instance the collector reaped', async () => {
    attach();
    const plain = Plain.new();
    await flushMicrotasks();
    collected(String(plain));
    collected(String(plain));
    expect(health()).toMatchObject({ orphans: 0, collected: 1 });
    expect(Instance.of(plain).alive).toBe(false);
  });
});
