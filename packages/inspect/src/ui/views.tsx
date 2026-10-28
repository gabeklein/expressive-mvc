import { Component } from '@expressive/mvc';
import { css, macro, style } from '@expressive/dom';
import type { Node } from '../inspect';
import { draft, Session } from './session';

macro(css);

interface Ref {
  $ref: string;
  $type: string;
}

const isRef = (value: unknown): value is Ref =>
  !!value && typeof value === 'object' && typeof (value as Ref).$ref === 'string';

const complex = (value: unknown) => value !== null && typeof value === 'object';

function Value({ value, onClick }: { value: unknown; onClick?: () => void }) {
  if (isRef(value))
    return (
      <button _ref onClick={onClick}>
        {value.$type} <span _dim>{value.$ref}</span>
      </button>
    );

  if (value === null)
    return (
      <span _kw onClick={onClick}>
        null
      </span>
    );

  if (typeof value === 'object') return <span onClick={onClick}>{Array.isArray(value) ? `[${value.length}]` : '{…}'}</span>;

  if (typeof value === 'string')
    return (
      <span _str onClick={onClick}>
        "{value}"
      </span>
    );

  if (typeof value === 'number')
    return (
      <span _num onClick={onClick}>
        {String(value)}
      </span>
    );

  return (
    <span _kw onClick={onClick}>
      {String(value)}
    </span>
  );
}

function Entries({ address, value }: { address: string; value: object }) {
  const session = Session.get();
  return (
    <>
      {Object.entries(value)
        .filter(([key]) => key[0] !== '$')
        .map(([key, child]) => (
          <EntryRow key={key} session={session} address={`${address}.${key}`} name={key} value={child} />
        ))}
    </>
  );
}

function Expanded({ address, value }: { address: string; value: unknown }) {
  const session = Session.get();
  const current = session.values.get(address) ?? value;

  if (isRef(current)) {
    const snapshot = session.values.get(current.$ref);
    return snapshot ? <Entries address={current.$ref} value={snapshot} /> : <div _dim>…</div>;
  }

  return <Entries address={address} value={current as object} />;
}

class EntryRow extends Component {
  session!: Session;
  address = '';
  name = '';
  value: unknown = undefined;
  editing = false;
  text = '';

  async toggle() {
    const { session, address, value } = this;
    await session.expand(address);
    if (session.expanded.has(address) && isRef(value)) await session.load(value.$ref);
  }

  commit() {
    this.editing = false;
    void this.session.write(this.address, isRef(this.value) ? { $ref: this.text } : draft(this.text));
  }

  render() {
    const { session } = this;
    const { address, name, value, editing, text } = this;
    const open = session.expanded.has(address);

    return (
      <div>
        <div _row>
          {complex(value) ? (
            <button _twisty onClick={() => this.toggle()}>
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span _twisty />
          )}
          <span _name>{name}</span>
          {editing ? (
            <input
              value={text}
              autofocus
              onInput={(e) => (this.text = e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') this.commit();
                if (e.key === 'Escape') this.editing = false;
              }}
              onBlur={() => this.commit()}
            />
          ) : (
            <Value
              value={value}
              onClick={() => {
                this.editing = true;
                this.text = typeof value === 'string' ? value : (JSON.stringify(value) as string);
              }}
            />
          )}
        </div>
        {open && (
          <div _children>
            <Expanded address={address} value={value} />
          </div>
        )}
      </div>
    );
  }
}

function TreeNode({ node }: { node: Node }) {
  const session = Session.get();
  const open = session.expanded.has(node.id);
  const snapshot = session.values.get(node.id);

  return (
    <div>
      <div _row _sel={session.selected === node.id}>
        <button _twisty onClick={() => session.expand(node.id)}>
          {open ? '▾' : '▸'}
        </button>
        <button _type onClick={() => session.select(node.id)}>
          {node.type}
        </button>
        <span _id>{node.id}</span>
      </div>
      {open && (
        <div _children>
          {snapshot ? <Entries address={node.id} value={snapshot} /> : <div _dim>…</div>}
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView() {
  const { nodes } = Session.get();
  return <div _pane>{nodes.length ? nodes.map((node) => <TreeNode key={node.id} node={node} />) : <div _empty>No instances.</div>}</div>;
}

function TableView() {
  const session = Session.get();
  const { models, selected } = session;

  return (
    <div _pane>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>type</th>
            <th>parent</th>
            <th>keys</th>
            <th>absent</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr key={model.id} _sel={model.id === selected} onClick={() => session.select(model.id)}>
              <td>{model.id}</td>
              <td>{model.type}</td>
              <td>{model.parent}</td>
              <td>{model.keys.join(', ')}</td>
              <td>{model.absent.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {models.length === 0 && <div _empty>No instances.</div>}
    </div>
  );
}

function DetailView() {
  const session = Session.get();
  const { selected, values, models } = session;

  if (!selected) return <div _empty>Select an instance.</div>;

  const info = models.find((m) => m.id === selected);
  const snapshot = values.get(selected);

  return (
    <div _pane>
      <header _detail>
        <strong>{info?.type ?? selected}</strong>
        <span _id>{selected}</span>
        {info?.parent && (
          <button _ref onClick={() => session.select(info.parent!)}>
            ↑ {info.parent}
          </button>
        )}
      </header>
      {snapshot ? <Entries address={selected} value={snapshot} /> : <div _dim>…</div>}
      {info?.absent.map((key) => (
        <div key={key} _row _dim>
          <span _twisty />
          <span _name>{key}</span>
          <span>—</span>
        </div>
      ))}
    </div>
  );
}

export class App extends Component {
  render() {
    const session = Session.get();
    const { status, error, pages, page, tab, selected } = session;

    return (
      <div>
        <header _bar>
          <strong>Expressive</strong>
          <select value={page} onChange={(e) => void session.use(e.currentTarget.value)}>
            {!page && <option value="">select a page…</option>}
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || p.url}
              </option>
            ))}
          </select>
          <nav>
            <button _on={tab === 'tree'} onClick={() => (session.tab = 'tree')}>
              Tree
            </button>
            <button _on={tab === 'table'} onClick={() => (session.tab = 'table')}>
              Table
            </button>
          </nav>
        </header>
        {status === 'open' ? (
          <div _split>
            <div _main>{tab === 'tree' ? <TreeView /> : <TableView />}</div>
            <DetailView />
          </div>
        ) : (
          <div _empty>{status === 'connecting' ? 'Connecting…' : error || status}</div>
        )}
      </div>
    );
  }
}

style(App, {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '12px',
  color: '#d4d4d4',
  background: '#1e1e1e',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  _bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderBottom: '1px solid #333',
    background: '#252526',
    _select: { background: '#3c3c3c', color: 'inherit', border: 'none', padding: 2 },
    _nav: { marginLeft: 'auto', display: 'flex', gap: 4 },
    _button: {
      background: 'none',
      border: 'none',
      color: '#888',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      padding: '2px 6px'
    },
    _on: { color: '#fff', background: '#094771' }
  }
});

macro({
  _split: { display: 'flex', flex: 1, minHeight: 0 },
  _main: { flex: 1, overflow: 'auto' },
  _pane: { padding: 4, overflow: 'auto', flex: 1 },
  _empty: { padding: 16, color: '#888' },
  _row: { display: 'flex', alignItems: 'baseline', gap: 4, padding: '1px 0', whiteSpace: 'nowrap' },
  _sel: { background: '#094771' },
  _twisty: {
    width: 14,
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    padding: 0,
    textAlign: 'center'
  },
  _type: { background: 'none', border: 'none', color: '#4ec9b0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 },
  _ref: { background: 'none', border: 'none', color: '#4ec9b0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 },
  _id: { color: '#808080' },
  _name: { color: '#9cdcfe' },
  _str: { color: '#ce9178', cursor: 'text' },
  _num: { color: '#b5cea8', cursor: 'text' },
  _kw: { color: '#569cd6', cursor: 'text' },
  _dim: { color: '#606060' },
  _children: { paddingLeft: 18 },
  _detail: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    padding: '2px 0 6px',
    borderBottom: '1px solid #333',
    marginBottom: 4
  },
  _table: {
    borderCollapse: 'collapse',
    _td: { padding: '2px 8px', textAlign: 'left' },
    _th: { padding: '2px 8px', textAlign: 'left', color: '#888', borderBottom: '1px solid #333' }
  },
  _tr: { cursor: 'pointer' },
  _input: { background: '#3c3c3c', color: 'inherit', border: '1px solid #007fd4', fontFamily: 'inherit', fontSize: 'inherit' }
});
