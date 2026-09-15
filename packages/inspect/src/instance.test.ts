import { State, has } from '@expressive/mvc';
import { describe, expect, it } from 'vitest';

import { attach, find, Instance, instances, label, models, resolve, roots } from './index';

class Child extends State {
  name = 'kid';
}

class Parent extends State {
  child = new Child();
  kids = has(Child);
  title = 'root';

  rename(next: string) {
    this.title = next;
  }
}

describe('Instance', () => {
  it('will navigate ownership', () => {
    attach();
    const parent = Parent.new();
    const kid = parent.kids.add();
    const loose = Child.new();

    expect(roots().map((h) => h.id)).toEqual([String(parent), String(loose)]);
    expect(instances().length).toBe(4);

    const root = find('Parent')!;
    expect(root.type).toBe('Parent');
    expect(root.parent).toBeUndefined();
    expect(root.children.map((h) => h.id)).toEqual([String(parent.child), String(kid)]);
    expect(find(String(kid))!.parent!.id).toBe(String(parent));
    expect(root.find('Child')!.id).toBe(String(parent.child));
    expect(root.find((h) => h.id === String(kid))!.id).toBe(String(kid));
    expect(root.find('Nope')).toBeUndefined();
  });

  it('will keep one Instance per state and reflect ownership changes', () => {
    attach();
    const parent = Parent.new();
    const root = find('Parent')!;
    expect(find(String(parent))).toBe(root);
    expect(root.children[0]).toBe(root.children[0]);
    expect(root.children[0]).toBe(Instance.of(parent.child));

    parent.kids.add();
    expect(root.children.length).toBe(2);

    parent.title = 'primitive write';
    expect(root.children.length).toBe(2);
  });

  it('will outlive destruction with alive, since, and until', () => {
    attach();
    const parent = Parent.new();
    const child = Instance.of(parent.child);
    expect(child.alive).toBe(true);
    expect(child.since).toBeLessThanOrEqual(Date.now());
    expect(child.until).toBeUndefined();

    const seen: Array<string | null> = [];
    child.watch((key) => seen.push(key));
    parent.set(null);

    expect(child.alive).toBe(false);
    expect(child.until).toBeGreaterThanOrEqual(child.since);
    expect(seen).toEqual([null]);
    expect(find('Child')).toBeUndefined();
    expect(child.parent).toBeUndefined();
  });

  it('will find deep descendants', () => {
    class Grand extends State {
      parent = new Parent();
    }
    attach();
    const grand = Grand.new();
    expect(find('Grand')!.find('Child')!.id).toBe(String(grand.parent.child));
  });

  it('will read and describe', () => {
    attach();
    Parent.new();
    const instance = find('Parent')!;
    expect(instance.get('title')).toBe('root');
    expect((instance.get() as any).$type).toBe('Parent');
    expect(instance.model()).toMatchObject({ type: 'Parent', absent: [] });
    expect(instance.model().keys.sort()).toEqual(['child', 'kids', 'title']);
    expect(find('Nope')).toBeUndefined();
  });

  it('will act and return the frames produced', async () => {
    attach();
    const parent = Parent.new();
    const instance = find('Parent')!;
    const frames = await instance.act((state) => (state as Parent).rename('acted'));
    expect(parent.title).toBe('acted');
    expect(frames.length).toBe(1);
    expect(frames[0].events[0]).toMatchObject({ key: 'title', value: 'acted' });
    expect(instance.frames().length).toBe(1);
    expect(instance.frames({ since: 1 })).toEqual([]);
  });

  it('will watch updates with optional key filter', async () => {
    attach();
    const parent = Parent.new();
    const instance = find('Parent')!;
    const all: Array<string | null> = [];
    const some: Array<string | null> = [];
    const stopAll = instance.watch((key) => all.push(key));
    const stopSome = instance.watch((key) => some.push(key), ['title']);
    parent.title = 'a';
    parent.child = Child.new();
    parent.set('custom');
    stopAll();
    stopSome();
    parent.title = 'b';
    expect(all).toEqual(['title', 'child', 'custom']);
    expect(some).toEqual(['title']);
  });
});

describe('type labels', () => {
  it('will assign a stable typeId and capture a site', () => {
    attach();
    Child.new();
    Child.new();
    const rows = models();
    expect(rows[0].typeId).toBe(rows[1].typeId);
    expect(rows[0].typeId).toMatch(/^T\d+$/);
    expect(rows[0].site).toContain('at ');
  });

  it('will prefer an explicit label, then a resolved name, then a readable class name', () => {
    const T = class extends State {
      value = 1;
    };
    Object.defineProperty(T, 'name', { value: 't' });
    attach();
    T.new();
    const row = models()[0];
    expect(row.type).toBe(row.typeId);

    resolve({ [row.typeId]: 'FromTable' });
    expect(models()[0].type).toBe('FromTable');
    expect(find('FromTable')).toBeDefined();

    resolve({ [row.site]: 'FromSite' });
    expect(models()[0].type).toBe('FromTable');

    label(T, 'Explicit');
    expect(models()[0].type).toBe('Explicit');
  });

  it('will resolve by site and displayName', () => {
    const T = class extends State {
      value = 1;
    };
    Object.defineProperty(T, 'name', { value: 't' });
    attach();
    T.new();
    const row = models()[0];
    resolve({ [row.site]: 'FromSite' });
    expect(models()[0].type).toBe('FromSite');

    const D = class extends State {
      static displayName = 'Display';
      value = 1;
    };
    D.new();
    expect(find('Display')).toBeDefined();
  });
});
