import { Caught, State, has, map, set } from '@expressive/mvc';
import { describe, expect, it } from 'vitest';

import { flushMicrotasks, mockUncaught, mockWarn } from '../test.setup';
import { act, attach, call, detach, find, get, health, journal, models, set as assign, tree } from './index';

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

describe('get with a selection', () => {
  it('will pick keys and follow a child State, keeping refs', () => {
    attach();
    const parent = Parent.new();

    expect(get('Parent', { title: true, child: { name: true } })).toEqual({
      $ref: String(parent),
      $type: 'Parent',
      title: 'root',
      child: { $ref: String(parent.child), $type: 'Child', name: 'kid' }
    });
  });

  it('will start from a path', () => {
    attach();
    Parent.new();
    expect(get('Parent.child', { name: true })).toMatchObject({ $type: 'Child', name: 'kid' });
  });

  it('will apply to each element of a list, capped as get is', () => {
    class Table extends State {
      rows = Array.from({ length: 30 }, (_, id) => ({ id, title: `row ${id}`, extra: { big: true } }));
      few = [{ id: 1, title: 'one' }];
    }

    attach();
    Table.new();
    const rows = (get('Table', { rows: { id: true } }) as { rows: unknown[] }).rows;

    expect(rows.slice(0, 2)).toEqual([{ id: 0 }, { id: 1 }]);
    expect(rows).toHaveLength(25);
    expect(rows[24]).toBe('…+6');
    expect(get('Table', { few: { id: true } })).toMatchObject({ few: [{ id: 1 }] });
  });

  it('will pick from a Map', () => {
    attach();
    const parent = Parent.new();
    parent.lookup.set('a', new Child());

    expect(get('Parent', { lookup: { a: { name: true } } })).toMatchObject({ lookup: { a: { name: 'kid' } } });
  });

  it('will take a selected value whole, as get does', () => {
    attach();
    Parent.new();

    expect(get('Parent', { child: true })).toMatchObject({ child: get('Parent.child') });
    expect(get('Parent', { title: { length: true } })).toMatchObject({ title: 'root' });
  });

  it('will not trigger lazy values or read missing keys', () => {
    attach();
    Parent.new();

    const out = get('Parent', { lazy: true, missing: { deep: true } }) as Record<string, unknown>;

    expect(out.lazy).toBeUndefined();
    expect(out.missing).toBeUndefined();
  });
});

describe('labels shared by several classes', () => {
  const declare = () =>
    class Control extends State {
      value = 0;
    };

  it('will throw rather than pick one', () => {
    attach();
    declare().new();
    declare().new();

    expect(() => find('Control')).toThrow(/^Control matches 2 classes \(T\d+, T\d+\) - address by instance id or owner path, or label\(\) one\./);
    expect(() => get('Control.value')).toThrow(/matches 2 classes/);
  });

  it('will reach each by instance id', () => {
    attach();
    const first = declare().new();
    declare().new();

    expect(get(`${first}.value`)).toBe(0);
  });

  it('will reject an act waiting on one', async () => {
    attach();
    declare().new();
    declare().new();

    await expect(act(() => {}, { until: 'Control.value' })).rejects.toThrow(/matches 2 classes/);
  });
});

describe('act until an address', () => {
  class Part extends State {
    value = 0;
  }

  class Holder extends State {
    part = new Part();
  }

  it('will follow an owner path to the instance it names', async () => {
    attach();
    const holder = Holder.new();
    const stray = Part.new();

    const frames = await act(
      () => {
        setTimeout(() => {
          stray.value = 1;
          setTimeout(() => (holder.part.value = 2), 5);
        });
      },
      { until: 'Holder.part.value' }
    );

    expect(frames.at(-1)!.events[0]).toMatchObject({ id: String(holder.part), value: 2 });
  });

  it('will record an owner path the app filter excludes', async () => {
    attach();
    journal.record({ level: 'keys', types: ['Nope'] });
    const holder = Holder.new();

    const frames = await act(() => void setTimeout(() => (holder.part.value = 3), 5), { until: 'Holder.part.value' });

    expect(frames.at(-1)!.events[0]).toMatchObject({ id: String(holder.part), value: 3 });
    expect(journal.record()).toMatchObject({ types: ['Nope'], paths: [] });
  });

  it('will follow a label to its first instance only', async () => {
    attach();
    Part.new();
    const second = Part.new();

    const failed = act(() => void setTimeout(() => (second.value = 1)), { until: 'Part.value', timeout: 30 });

    await expect(failed).rejects.toThrow('Not reached within 30ms: Part.value.');
    await expect(failed).rejects.toMatchObject({ pending: ['Part.value'], frames: [expect.objectContaining({})] });
  });

  it('will throw for an address that names no State', async () => {
    attach();
    Holder.new();

    await expect(act(() => {}, { until: 'Missing.value' })).rejects.toThrow('until Missing.value: Missing names no State.');
    await expect(act(() => {}, { until: 'Holder.part.value.x' })).rejects.toThrow('Holder.part.value names no State.');
  });

  it('will throw for an unmanaged _ key', async () => {
    attach();
    Holder.new();

    await expect(act(() => {}, { until: 'Holder._handle' })).rejects.toThrow('until Holder._handle: _ keys are unmanaged');
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

  it('will count caught reports by case and pass them on', async () => {
    const warn = mockWarn();
    attach();
    const note = Note.new();

    note.set(null);
    note.text = 'late';
    await flushMicrotasks();

    expect(warn).not.toBeCalled();
    expect(health().caught).toEqual({ Destroyed: 1, Inactive: 0, Getter: 0, Init: 0, Effect: 0 });
  });

  it('will see a report before an app handler takes it', () => {
    attach();

    class Late extends State {
      text = '';
    }

    const stop = State.on({ catch: (error) => (error instanceof Caught.Destroyed ? undefined : error) });
    const late = Late.new();

    late.set(null);
    late.text = 'late';
    stop();

    expect(health().caught.Destroyed).toBe(1);
  });

  it('will stop observing a class when detached', async () => {
    const warn = mockWarn();
    const stop = attach();

    class Gone extends State {
      text = '';
    }

    const gone = Gone.new();

    stop();
    gone.set(null);

    gone.text = 'late';
    await flushMicrotasks();

    expect(warn).not.toBeCalled();
    expect(health().caught.Destroyed).toBe(0);
  });

  it('will record a caught report in the journal', async () => {
    mockUncaught();
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
      value: {
        case: 'Destroyed',
        message: `Tried to update ${note}.text but state is destroyed.`,
        stack: expect.stringContaining('Tried to update'),
        handled: false
      }
    });
  });

  it('will mark a report an app handler took as handled', async () => {
    attach();
    journal.record({ level: 'keys' });

    class Dropped extends State {
      text = '';
    }

    const stop = State.on({ catch: (error) => (error instanceof Caught.Destroyed ? undefined : error) });
    const dropped = Dropped.new();

    dropped.set(null);
    dropped.text = 'late';
    stop();

    const [event] = journal.history({ type: 'Dropped' }).map(({ event }) => event).filter((e) => e.kind === 'caught');

    expect(event.value).toMatchObject({ case: 'Destroyed', handled: true });
  });

  it('will count a report from a class it never saw activate', async () => {
    mockWarn();
    attach();
    journal.record({ level: 'keys' });

    class Idle extends State {}

    new Idle();
    await flushMicrotasks();

    expect(health().caught.Inactive).toBe(1);
    expect(journal.history({ type: 'Idle' })[0].event.value).toMatchObject({ case: 'Inactive', handled: false });
  });

  it('will reset caught counts when the journal clears', () => {
    mockUncaught();
    attach();
    const note = Note.new();

    note.set(null);
    note.text = 'late';
    expect(health().caught.Destroyed).toBe(1);

    journal.clear();
    expect(health().caught.Destroyed).toBe(0);
  });

  it('will count caught reports in the summary', async () => {
    mockUncaught();
    attach();
    journal.record({ level: 'keys' });
    const note = Note.new();

    note.set(null);
    note.text = 'late';
    await flushMicrotasks();

    expect(journal.summary({ id: String(note) })[0]).toMatchObject({ caught: 1, destroyed: true });
  });

  it('will record a replacement it has no case for without counting it', async () => {
    const caught = mockUncaught();
    attach();
    journal.record({ level: 'keys' });

    class Replaced extends State {
      text = '';
    }

    const replaced = Replaced.new();
    const stop = Replaced.on({ catch: (error) => new Caught(error.state, 'replaced') });

    replaced.set(null);
    replaced.text = 'late';
    stop();
    await flushMicrotasks();

    expect(health().caught.Destroyed).toBe(0);
    expect(journal.history({ type: 'Replaced' }).map(({ event }) => event.value)).toContainEqual(
      expect.objectContaining({ case: 'Caught', message: 'replaced', handled: false })
    );
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
