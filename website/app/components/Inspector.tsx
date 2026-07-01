import { Component, get } from '@expressive/react';

import Workspace from './Workspace';

type FieldType = { type: string; value?: unknown; text?: string };

export default class Inspector extends Component {
  tree: { name: string; instances: string[] }[] = [];
  focused: string | null = null;
  fields: Record<string, FieldType> = {};
  drafts: Record<string, string> = {};

  workspace = get(Workspace);

  protected new() {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || msg.source !== 'expressive') return;
      if (msg.kind === 'registry') this.tree = msg.tree;
      else if (msg.kind === 'values' && msg.id === this.focused) {
        this.fields = msg.fields;
        this.drafts = {};
      }
    };
    window.addEventListener('message', onMessage);
    this.workspace.send({ kind: 'sync' });
    return () => window.removeEventListener('message', onMessage);
  }

  focus(id: string) {
    this.focused = id;
    this.fields = {};
    this.drafts = {};
    this.workspace.send({ kind: 'focus', id });
  }

  edit(key: string, value: string) {
    this.drafts = { ...this.drafts, [key]: value };
  }

  commit(key: string) {
    const value = this.drafts[key];
    if (value === undefined) return;
    this.workspace.send({ kind: 'set', id: this.focused, key, value });
  }

  render() {
    const { fields } = this;

    self: {
      display: flex;
      flex: 1;
      minHeight: 0;
      fontSize: 0.9;
      fontFamily: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    }

    fields: {
      flex: 1;
      overflowY: auto;
      gridColumns: "max-content", "1fr";
      alignContent: start;
      borderTop: $colorFdBorder, 1;
    }

    return (
      <div _self>
        <Tree />
        <div _fields>
          {Object.entries(fields).map(([name, field]) => (
            <Field key={name} name={name} field={field} />
          ))}
        </div>
      </div>
    );
  }
}

function Tree() {
  const { tree, focused, focus } = Inspector.get();

  flexShrink: 0;
  width: 180;
  overflowY: auto;
  borderRight: $colorFdBorder, 1;
  padding: 6;

  type: {
    color: $colorFdMutedForeground;
    fontSize: 0.8;
    textTransform: uppercase;
    letterSpacing: '0.06em';
    padding: 4, 4, 2;
  }

  instance: {
    display: "block";
    width: fill;
    textAlign: left;
    padding: 3, 4, 3, 12;
    border: none;
    background: none;
    color: $colorFdForeground;
    cursor: pointer;
    whiteSpace: nowrap;

    $hover: { color: $accent; }

    if("[aria-pressed='true']") {
      color: $accent;
    }
  }

  return (
    <div>
      {tree.map((t) => (
        <div key={t.name}>
          <div _type>{t.name}</div>
          {t.instances.map((id) => (
            <button _instance key={id} aria-pressed={focused === id} onClick={() => focus(id)}>
              {id}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Field({ name, field }: { name: string; field: FieldType }) {
  const { drafts, edit, commit } = Inspector.get();
  const editable = field.type !== 'fn' && field.type !== 'object';
  const shown = field.type === 'fn' ? 'ƒ'
    : field.type === 'object' ? String(field.text)
    : drafts[name] ?? String(field.value);

  // Each row's two cells drop straight into the parent grid.
  display: "contents";

  key: {
    padding: 4, 10;
    color: $colorFdMutedForeground;
    whiteSpace: nowrap;
    borderBottom: $colorFdBorder, 1;
    borderRight: $colorFdBorder, 1;
  }

  value: {
    minWidth: 0;
    padding: 4, 20, 4, 10;
    color: $colorFdForeground;
    background: none;
    border: none;
    borderBottom: $colorFdBorder, 1;
    fontFamily: inherit;
    fontSize: inherit;
    cursor: text;

    $focus: {
      outline: none;
      background: $colorFdMuted;
    }

    $readOnly: {
      color: $colorFdMutedForeground;
      cursor: "default";
    }
  }

  return (
    <div>
      <span _key>{name}</span>
      <input
        _value
        value={shown}
        readOnly={!editable}
        onChange={(e) => edit(name, e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit(name)}
      />
    </div>
  );
}
