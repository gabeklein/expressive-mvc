import { Model } from '@expressive/mvc';

import type { Call } from '../dispatch';
import type { ModelInfo, Node } from '../inspect';
import type { Frame } from '../journal';
import type { Limits } from '../serialize';
import { remote, type PageInfo, type Remote } from './remote';
import type { Connection } from './socket';

const POLL = 250;
const EVERY = 8;

/** Uncapped-enough limits for the editor and deep expansion. */
export const WIDE: Limits = { depth: 8, string: 100000, array: 500, keys: 200 };

export class Session extends Model {
  static readonly global = true;
  status: 'connecting' | 'open' | 'denied' | 'closed' = 'connecting';
  error = '';
  pages: PageInfo[] = [];
  page = '';
  tab: 'tree' | 'table' = 'tree';
  nodes: Node[] = [];
  models: ModelInfo[] = [];
  selected = '';
  expanded = new Set<string>();
  values = new Map<string, unknown>();
  since = 0;
  tick = 0;

  _connection?: Connection;
  _remote?: Remote;
  _timer?: ReturnType<typeof setInterval>;

  async open(connection: Connection) {
    this._connection = connection;
    this._remote = remote((call?: Call) => connection.send(call, this.page || undefined));
    connection.watch((pages) => {
      if (!Array.isArray(pages)) {
        this.status = 'denied';
        this.error = pages.error;
        return;
      }
      this.pages = pages;
      if (pages.length === 1) this.page = pages[0].id;
      else if (!pages.some((p) => p.id === this.page)) this.page = '';
    });
    try {
      await this.refresh();
      this.since = await this._remote.journal.seq();
      if (this.status === 'denied') return;
      this.status = 'open';
      this._timer = setInterval(() => void this.poll(), POLL);
      this.get(null, () => clearInterval(this._timer));
    } catch (error) {
      this.status = 'closed';
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  /** Point every call at another page; drops cached values. */
  async use(id: string) {
    if (this.page === id) return;
    this.page = id;
    this.values = new Map();
    this.expanded = new Set();
    this.selected = '';
    await this.refresh();
    if (this._remote) this.since = await this._remote.journal.seq();
  }

  async refresh() {
    const remote = this._remote;
    if (!remote) return;
    const [nodes, models] = await Promise.all([remote.tree(), remote.models()]);
    this.nodes = nodes;
    this.models = models;
  }

  /** Read an address into the value cache at editor-friendly limits. */
  async load(address: string) {
    const remote = this._remote;
    if (!remote) return;
    const value = await remote.get(address, undefined, WIDE);
    const values = new Map(this.values);
    if (value === undefined) values.delete(address);
    else values.set(address, value);
    this.values = values;
  }

  async expand(address: string) {
    const expanded = new Set(this.expanded);
    if (!expanded.delete(address)) expanded.add(address);
    this.expanded = expanded;
    if (expanded.has(address) && !this.values.has(address)) await this.load(address);
  }

  select(id: string) {
    this.selected = this.selected === id ? '' : id;
    if (this.selected && !this.values.has(id)) void this.load(id);
  }

  /** Commit an edited value, then reload every cached address it could touch. */
  async write(address: string, value: unknown) {
    const remote = this._remote;
    if (!remote) return;
    await remote.set(address, value);
    const root = address.split('.')[0];
    await Promise.all([...this.values.keys()].filter((a) => a.split('.')[0] === root).map((a) => this.load(a)));
  }

  async poll() {
    const remote = this._remote;
    if (!remote || this.status !== 'open') return;

    const frames = await remote.journal.frames({ since: this.since }).catch(() => [] as Frame[]);
    const dirty = new Set<string>();
    let structure = false;

    for (const frame of frames) {
      this.since = Math.max(this.since, frame.seq);
      for (const event of frame.events) {
        dirty.add(event.id);
        if (event.kind === 'destroy' || event.kind === 'hot') structure = true;
      }
    }

    if (++this.tick % EVERY === 0 || structure) await this.refresh();

    const stale = [...this.values.keys()].filter((a) => dirty.has(a.split('.')[0]));
    await Promise.all(stale.map((a) => this.load(a)));
  }
}

/** Parse a draft: JSON when it parses, the raw string otherwise. */
export function draft(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
