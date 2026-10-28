// @vitest-environment happy-dom
import { Model } from '@expressive/mvc';
import { render } from '@expressive/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushMicrotasks } from '../../test.setup';
import { dispatch, type Call } from '../dispatch';
import { attach, inspect, journal } from '../index';
import { Session } from './session';
import type { PageInfo } from './remote';
import type { Connection } from './socket';
import { App } from './views';

class Composer extends Model {
  draft = '';
  count = 0;
}

class Holder extends Model {
  composer = new Composer();
}

class Mixed extends Model {
  flag = true;
  nil: null = null;
  obj = { a: 1 };
  list = [1, 2];

  get computed() {
    return this.flag;
  }
}

function connection() {
  const watchers: ((pages: PageInfo[] | { error: string }) => void)[] = [];
  const conn: Connection = {
    send: vi.fn(async (call?: Call) => (call ? dispatch(call) : [])),
    watch: (fn) => void watchers.push(fn),
    close: vi.fn()
  };
  return { conn, roster: (pages: PageInfo[] | { error: string }) => watchers.forEach((w) => w(pages)) };
}

const PAGE = { id: 'p1', url: 'http://localhost/', title: 'App', top: true };
const PAGE2 = { id: 'p2', url: 'http://localhost/2', title: 'Second', top: true };

function setup() {
  const session = Session.new();
  attach();
  const { conn, roster } = connection();
  const host = document.createElement('div');
  document.body.append(host);

  const mounted = async () => {
    const opening = session.open(conn);
    roster([PAGE]);
    await opening;
    render(<App />, host);
    await flushMicrotasks();
    return host;
  };

  return { session, conn, roster, host, mounted, unmount: () => void session.set(null) };
}

const click = (el: Element | null | undefined) => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const text = (host: HTMLElement) => host.textContent ?? '';
const buttons = (host: HTMLElement, label?: string) =>
  [...host.querySelectorAll('button')].filter((b) => label === undefined || b.textContent === label);
const twisty = (host: HTMLElement, n = 0) => buttons(host, '▸')[n] ?? buttons(host, '▾')[n];
const input = (el: Element, value: string) => {
  (el as HTMLInputElement).value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

beforeEach(() => {
  journal.record({ level: 'keys' });
  globalThis.__EXPRESSIVE_INSPECT__ = inspect;
  document.body.innerHTML = '';
});

describe('App', () => {
  it('will show a connecting state before open and the tree after', async () => {
    const { session, conn, roster, host, unmount } = setup();

    render(<App />, host);
    expect(text(host)).toContain('Connecting…');

    Composer.new();
    roster([PAGE]);
    await session.open(conn);
    await flushMicrotasks();

    expect(text(host)).toContain('Composer');
    expect(text(host)).toContain('Tree');
    expect(text(host)).toContain('Table');

    unmount();
  });

  it('will show denied and closed states', async () => {
    const denied = Session.new();
    const host = document.createElement('div');
    document.body.append(host);
    render(<App />, host);

    denied.status = 'denied';
    denied.error = 'Dev token mismatch.';
    await flushMicrotasks();
    expect(text(host)).toContain('Dev token mismatch.');

    denied.status = 'closed';
    denied.error = '';
    await flushMicrotasks();
    expect(text(host)).toContain('closed');
    denied.set(null);
  });

  it('will list pages in the picker and switch on change', async () => {
    const { session, roster, host, mounted, unmount } = setup();
    await mounted();

    const select = host.querySelector('select')! as HTMLSelectElement;
    expect(select.querySelectorAll('option')).toHaveLength(1);

    roster([PAGE, PAGE2, { id: 'p3', url: 'http://localhost/3', title: '', top: true }]);
    await flushMicrotasks();
    expect(select.querySelectorAll('option')).toHaveLength(3);
    expect(text(host)).toContain('http://localhost/3');

    select.value = 'p2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();
    expect(session.page).toBe('p2');

    unmount();
  });

  it('will show an empty placeholder when there are no instances', async () => {
    const { host, mounted, unmount } = setup();
    await mounted();
    expect(text(host)).toContain('No instances.');
    unmount();
  });
});

describe('tree view', () => {
  it('will expand a node to its entries and collapse it', async () => {
    const { host, mounted, unmount } = setup();
    Composer.new();
    await mounted();

    click(twisty(host));
    await flushMicrotasks();

    expect(text(host)).toContain('draft');
    expect(text(host)).toContain('count');
    expect(text(host)).toContain('0');

    click(buttons(host, '▾')[0]);
    await flushMicrotasks();
    expect(text(host)).not.toContain('draft');

    unmount();
  });

  it('will expand a $ref row to the child instance', async () => {
    const { host, mounted, unmount } = setup();
    Holder.new();
    await mounted();

    click(twisty(host));
    await flushMicrotasks();
    expect(text(host)).toContain('composer');

    click(buttons(host, '▸')[0]);
    await flushMicrotasks();

    expect(text(host)).toContain('draft');

    unmount();
  });

  it('will render every value kind', async () => {
    const { host, mounted, unmount } = setup();
    Mixed.new();
    await mounted();

    click(twisty(host));
    await flushMicrotasks();

    expect(text(host)).toContain('true');
    expect(text(host)).toContain('null');
    expect(text(host)).toContain('{…}');
    expect(text(host)).toContain('[2]');

    click(buttons(host, '▸')[0]);
    await flushMicrotasks();
    expect(text(host)).toContain('a');

    unmount();
  });

  it('will show a loading mark for an expanded row without a snapshot', async () => {
    const { session, host, mounted, unmount } = setup();
    const mixed = Mixed.new();
    await mounted();

    const id = String(mixed);
    await session.load(id);
    session.expanded = new Set([id, `${id}.obj`]);
    await flushMicrotasks();
    expect(text(host)).toContain('…');

    unmount();
  });

  it('will show a loading mark for an expanded node without a snapshot', async () => {
    const { session, host, mounted, unmount } = setup();
    const composer = Composer.new();
    await mounted();

    session.expanded = new Set([String(composer)]);
    await flushMicrotasks();
    expect(text(host)).toContain('…');

    unmount();
  });

  it('will select an instance through its type label', async () => {
    const { session, host, mounted, unmount } = setup();
    const composer = Composer.new();
    await mounted();

    click(buttons(host, 'Composer')[0]);
    await flushMicrotasks();

    expect(session.selected).toBe(String(composer));

    unmount();
  });
});

describe('table view', () => {
  it('will list models and select a row into the detail pane', async () => {
    const { session, host, mounted, unmount } = setup();
    Composer.new();
    await mounted();

    click(buttons(host, 'Table')[0]);
    await flushMicrotasks();

    expect(text(host)).toContain('keys');
    expect(text(host)).toContain('draft');
    expect(text(host)).toContain('count');

    click(host.querySelector('tbody tr'));
    await flushMicrotasks();

    expect(session.selected).not.toBe('');

    unmount();
  });

  it('will switch back to the tree tab', async () => {
    const { session, host, mounted, unmount } = setup();
    Composer.new();
    await mounted();

    click(buttons(host, 'Table')[0]);
    await flushMicrotasks();
    expect(text(host)).toContain('keys');

    click(buttons(host, 'Tree')[0]);
    await flushMicrotasks();
    expect(session.tab).toBe('tree');
    expect(text(host)).toContain('Composer');

    unmount();
  });

  it('will show an empty table message', async () => {
    const { session, host, mounted, unmount } = setup();
    await mounted();

    session.tab = 'table';
    await flushMicrotasks();
    expect(text(host)).toContain('No instances.');

    unmount();
  });
});

describe('detail view', () => {
  it('will show the parent link for a child instance', async () => {
    const { session, host, mounted, unmount } = setup();
    const holder = Holder.new();
    await mounted();

    session.select(String(holder.composer));
    await flushMicrotasks();

    expect(text(host)).toContain('↑');
    expect(text(host)).toContain(String(holder));

    click(buttons(host).find((b) => b.textContent?.includes('↑'))!);
    await flushMicrotasks();
    expect(session.selected).toBe(String(holder));

    unmount();
  });

  it('will show a loading mark while the snapshot is missing', async () => {
    const { session, host, mounted, unmount } = setup();
    await mounted();

    session.selected = 'Missing-1';
    await flushMicrotasks();
    expect(text(host)).toContain('…');

    unmount();
  });

  it('will list absent keys', async () => {
    const { session, host, mounted, unmount } = setup();
    const mixed = Mixed.new();
    await mounted();

    session.select(String(mixed));
    await flushMicrotasks();

    expect(text(host)).toContain('computed');
    expect(text(host)).toContain('—');

    unmount();
  });

  it('will show the placeholder with no selection', async () => {
    const { host, mounted, unmount } = setup();
    Composer.new();
    await mounted();

    expect(text(host)).toContain('Select an instance.');

    unmount();
  });
});

describe('editing', () => {
  it('will edit a leaf value on Enter', async () => {
    const { host, mounted, unmount } = setup();
    const composer = Composer.new();
    await mounted();

    click(twisty(host));
    await flushMicrotasks();

    const draftCell = [...host.querySelectorAll('span')].find((s) => s.textContent === '""');
    click(draftCell);
    await flushMicrotasks();

    const field = host.querySelector('input')!;
    expect(field).toBeDefined();
    input(field, 'changed');
    key(field, 'Enter');
    await flushMicrotasks();

    expect(composer.draft).toBe('changed');

    unmount();
  });

  it('will cancel an edit on Escape', async () => {
    const { host, mounted, unmount } = setup();
    const composer = Composer.new();
    await mounted();

    click(twisty(host));
    await flushMicrotasks();

    const draftCell = [...host.querySelectorAll('span')].find((s) => s.textContent === '""');
    click(draftCell);
    await flushMicrotasks();

    const field = host.querySelector('input')!;
    input(field, 'changed');
    key(field, 'Escape');
    await flushMicrotasks();

    expect(composer.draft).toBe('');
    expect(host.querySelector('input')).toBeNull();

    unmount();
  });

  it('will commit an edit on blur', async () => {
    const { host, mounted, unmount } = setup();
    const composer = Composer.new();
    await mounted();

    click(twisty(host));
    await flushMicrotasks();

    const draftCell = [...host.querySelectorAll('span')].find((s) => s.textContent === '""');
    click(draftCell);
    await flushMicrotasks();

    const field = host.querySelector('input')!;
    input(field, 'blurred');
    field.dispatchEvent(new Event('blur'));
    await flushMicrotasks();

    expect(composer.draft).toBe('blurred');

    unmount();
  });

  it('will edit a $ref row to another instance id', async () => {
    const { host, mounted, unmount } = setup();
    const holder = Holder.new();
    const stray = Composer.new();
    await mounted();

    click(twisty(host));
    await flushMicrotasks();

    const refButton = buttons(host).find((b) => b.textContent?.includes('Composer-'));
    click(refButton);
    await flushMicrotasks();

    const field = host.querySelector('input')!;
    input(field, String(stray));
    key(field, 'Enter');
    await flushMicrotasks();

    expect(holder.composer).toBe(stray);

    unmount();
  });
});
