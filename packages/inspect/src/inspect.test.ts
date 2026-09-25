import { Caught, State, has, map, set } from '@expressive/mvc';
import { describe, expect, it } from 'vitest';

import { flushMicrotasks, mockUncaught, mockWarn } from '../test.setup';
import { attach, call, detach, get, health, journal, models, set as assign, tree } from './index';

class Child extends State {
  name = 'kid';
}

class Parent extends State {
  child = new Child();
  kids = has(Child);
  lookup = map<string, Child>();
  lazy = set(() => 'computed');
  title = 'root';

  get upper() {
    return this.title.toUpperCase();
  }
  self = this;

  rename(next: string) {
    this.title = next;
    return next;
  }

  async later() {
    return 42;
  }
}

describe('attach', () => {
  it('will see instances created after attach', () => {
    attach();
    const parent = Parent.new();
    expect(models().map((m) => m.id)).toContain(String(parent));
  });

  it('will not see instances created before attach', () => {
    const before = Child.new();
    attach();
    const after = Child.new();
    expect(models().map((m) => m.id)).toEqual([String(after)]);
    expect(before).toBeDefined();
  });

  it('will attach once per class and detach', () => {
    const stop = attach();
    attach();
    stop();
    Child.new();
    expect(models()).toEqual([]);
    attach();
    Child.new();
    expect(models().length).toBe(1);
    detach();
    Child.new();
    expect(models()).toEqual([]);
  });

  it('will attach to a subclass only', () => {
    attach(Parent);
    Child.new();
    const parent = Parent.new();
    expect(models().map((m) => m.id)).toEqual([String(parent)]);
  });

  it('will forget destroyed instances', () => {
    attach();
    const child = Child.new();
    child.set(null);
    expect(models()).toEqual([]);
  });
});

describe('models', () => {
  it('will report keys, absent keys, and parent', () => {
    attach();
    const parent = Parent.new();
    const kid = parent.kids.add();
    const mapped = Child.new();
    parent.lookup.set('m', mapped);

    const byId = Object.fromEntries(models().map((m) => [m.id, m]));
    const root = byId[String(parent)];

    expect(root.type).toBe('Parent');
    expect(root.keys).toContain('title');
    parent.rename('bound');
    expect(root.absent).toEqual(['lazy', 'upper']);
    expect(models().find((m) => m.id === root.id)!.absent).toEqual(['lazy', 'upper']);
    expect(root.parent).toBeUndefined();
    expect(byId[String(parent.child)].parent).toBe(String(parent));
    expect(byId[String(kid)].parent).toBe(String(parent));
    expect(byId[String(mapped)].parent).toBe(String(parent));
  });

  it('will credit a shared child to its first owner', () => {
    class Twin extends State {
      shared = Child.new();
      numbers = has([1, 2]);
      names = map<string, string>();
      list = [this.shared];
    }
    attach();
    const a = Twin.new();
    const b = Twin.new();
    b.shared = a.shared;
    b.names.set('x', 'y');
    const byId = Object.fromEntries(models().map((m) => [m.id, m.parent]));
    expect(byId[String(a.shared)]).toBe(String(a));
  });

  it('will nest a tree by ownership', () => {
    attach();
    const parent = Parent.new();
    const loose = Child.new();
    const nodes = tree();
    expect(nodes.map((n) => n.id)).toEqual([String(parent), String(loose)]);
    expect(nodes[0].children.map((n) => n.id)).toEqual([String(parent.child)]);
  });
});

describe('get', () => {
  it('will list models without an address', () => {
    attach();
    Child.new();
    expect(get()).toEqual(models());
  });

  it('will resolve by type name or id', () => {
    attach();
    const first = Child.new();
    const second = Child.new();
    second.name = 'two';
    expect(get('Child.name')).toBe('kid');
    expect(get(`${second}.name`)).toBe('two');
    expect((get(String(first)) as any).$ref).toBe(String(first));
  });

  it('will return undefined for unknown targets', () => {
    attach();
    expect(get('Nope.x')).toBeUndefined();
  });

  it('will not trigger lazy values', () => {
    attach();
    Parent.new();
    expect(get('Parent.lazy')).toBeUndefined();
    expect(get('Parent.child.name')).toBe('kid');
  });
});

describe('set', () => {
  it('will assign top-level and nested values', () => {
    attach();
    const parent = Parent.new();
    assign('Parent.title', 'renamed');
    assign('Parent.child.name', 'named');
    assign('Parent.lookup.k', parent.child);
    expect(parent.title).toBe('renamed');
    expect(parent.child.name).toBe('named');
    expect(parent.lookup.get('k')).toBe(parent.child);
  });

  it('will throw for unknown targets', () => {
    attach();
    Parent.new();
    expect(() => assign('Nope.title', 1)).toThrow('No model at Nope.title.');
    expect(() => assign('Parent', 1)).toThrow('No model at Parent.');
    expect(() => assign('Parent.missing.deep', 1)).toThrow('No model at Parent.missing.deep.');
  });
});

describe('call', () => {
  it('will invoke methods and await results', async () => {
    attach();
    const parent = Parent.new();
    expect(await call('Parent.rename', 'called')).toBe('called');
    expect(parent.title).toBe('called');
    expect(await call('Parent.later')).toBe(42);
  });

  it('will throw for non-methods', async () => {
    attach();
    Parent.new();
    await expect(call('Parent.title')).rejects.toThrow('No method at Parent.title.');
    await expect(call('Nope.x')).rejects.toThrow('No method at Nope.x.');
  });
});

describe('health', () => {
  const COPIES = Symbol.for('@expressive/mvc');
  const list = () => (globalThis as unknown as Record<symbol, unknown[]>)[COPIES];

  class Note extends State {
    text = '';
  }

  it('will count caught reports by case and pass them on', () => {
    const warn = mockWarn();
    attach();
    const note = Note.new();

    note.set(null);
    note.text = 'late';

    expect(health().caught).toEqual({ Destroyed: 1, Inactive: 0, Getter: 0, Init: 0, Effect: 0 });
    expect(warn).toHaveBeenCalledWith(expect.any(Caught.Destroyed));
  });

  it('will record a caught report in the journal', async () => {
    mockWarn();
    attach();
    journal.record({ level: 'keys' });
    const note = Note.new();

    note.set(null);
    note.text = 'late';
    await flushMicrotasks();

    expect(journal.history({ key: 'text' }).map(({ event }) => event)).toContainEqual({
      id: String(note),
      type: 'Note',
      key: 'text',
      kind: 'caught',
      value: { case: 'Destroyed', message: `Tried to update ${note}.text but state is destroyed.` }
    });
  });

  it('will record a replacement it has no case for without counting it', async () => {
    const caught = mockUncaught();
    attach();
    journal.record({ level: 'keys' });

    class Replaced extends State {
      text = '';
    }

    const stop = Replaced.on({ catch: (error) => new Caught(error.state, 'replaced') });
    const replaced = Replaced.new();

    replaced.set(null);
    replaced.text = 'late';
    stop();
    await flushMicrotasks();

    expect(health().caught.Destroyed).toBe(0);
    expect(journal.history({ type: 'Replaced' }).map(({ event }) => event.value)).toContainEqual({
      case: 'Caught',
      message: 'replaced'
    });
    expect(caught).toEqual([expect.objectContaining({ message: 'replaced' })]);
  });

  it('will count loaded copies of mvc and warn once', () => {
    const warn = mockWarn();
    attach();
    const start = list().length;

    try {
      expect(health().copies).toBe(1);
      list().push(class Other {});
      expect(health().copies).toBe(2);
      list().push(class Another {});
      expect(health().copies).toBe(3);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '2 copies of @expressive/mvc are loaded - inspect sees only the one it imports.'
      );
    } finally {
      list().splice(start);
    }
  });

  it('will see a copy loaded before attach, and stop watching on detach', () => {
    mockWarn();
    detach();
    const start = list().length;
    const push = list().push;

    try {
      list().push(class Early {});
      attach();
      expect(health().copies).toBe(2);
      detach();
      expect(list().push).toBe(push);
      expect(health().copies).toBe(1);
    } finally {
      list().splice(start);
    }
  });
});
