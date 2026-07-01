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
      padding: 6;
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

  display: flex;
  alignItems: center;
  gap: 8;
  padding: 3, 0;

  key: {
    color: $colorFdMutedForeground;
    minWidth: 80;
  }

  value: {
    flex: 1;
    minWidth: 0;
    borderRadius: 4;
    padding: 4, 8;
    color: $colorFdForeground;
    fontFamily: inherit;
    fontSize: inherit;
    cursor: text;

    $focus: {
      outline: none;
      boxShadow: `0 0 0 1px #ddd`;
    }

    $readOnly: {
      border: none;
      background: none;
      color: $colorFdMutedForeground;
      cursor: "default";
      padding: 4, 0;
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
