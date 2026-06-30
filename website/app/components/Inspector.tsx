import { Component, get } from '@expressive/react';

import Workspace from './Workspace';

type Field = { type: string; value?: unknown; text?: string };

export default class Inspector extends Component {
  tree: { name: string; instances: string[] }[] = [];
  focused: string | null = null;
  fields: Record<string, Field> = {};

  workspace = get(Workspace);

  // Sandbox -> parent: registry tree on any (de)registration, focused
  // instance's live fields on any change. Re-sync whenever we (re)mount.
  protected new() {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || msg.source !== 'expressive') return;
      if (msg.kind === 'registry') this.tree = msg.tree;
      else if (msg.kind === 'values' && msg.id === this.focused) this.fields = msg.fields;
    };
    window.addEventListener('message', onMessage);
    this.workspace.send({ kind: 'sync' });
    return () => window.removeEventListener('message', onMessage);
  }

  focus(id: string) {
    this.focused = id;
    this.fields = {};
    this.workspace.send({ kind: 'focus', id });
  }

  render() {
    const { tree, fields, focused, focus, workspace } = this;

    self: {
      display: flex;
      flex: 1;
      minHeight: 0;
      fontSize: 0.8;
      fontFamily: "ui-monospace, monospace";
    }

    tree: {
      flexShrink: 0;
      width: 180;
      overflowY: auto;
      borderRight: $colorFdBorder, 1;
      padding: 6;
    }

    type: {
      color: $colorFdMutedForeground;
      padding: 2, 4;
    }

    instance: {
      display: "block";
      width: fill;
      textAlign: left;
      padding: 2, 4, 2, 12;
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

    fields: {
      flex: 1;
      overflowY: auto;
      padding: 6;
    }

    field: {
      display: flex;
      alignItems: center;
      gap: 8;
      padding: 1, 0;

      key: {
        color: $colorFdMutedForeground;
        minWidth: 80;
      }

      value: {
        flex: 1;
        border: $colorFdBorder, 1;
        borderRadius: 4;
        padding: 1, 4;
        background: $colorFdBackground;
        color: $colorFdForeground;
        fontFamily: "ui-monospace, monospace";
        fontSize: 0.8;
      }

      muted: {
        color: $colorFdMutedForeground;
      }
    }

    return (
      <div _self>
        <div _tree>
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
        <div _fields>
          {Object.entries(fields).map(([key, field]) => (
            <div _field key={key}>
              <span _key>{key}</span>
              {field.type === 'fn' ? <span _muted>ƒ</span>
                : field.type === 'object' ? <span _muted>{field.text}</span>
                : <input
                    _value
                    defaultValue={String(field.value)}
                    key={String(field.value)}
                    onKeyDown={(e) => e.key === 'Enter' && workspace.send({ kind: 'set', id: focused, key, value: e.currentTarget.value })}
                  />}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
