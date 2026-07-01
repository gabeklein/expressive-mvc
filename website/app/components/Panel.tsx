import { SandpackConsole } from '@codesandbox/sandpack-react';

import Workspace from './Workspace';
import Inspector from './Inspector';

export default function Panel() {
  const { showConsole, tab, consoleHeight, toggle, open, send, grabConsole } = Workspace.get();

  const dispatch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const code = event.currentTarget.value.trim();
    if (!code) return;
    send({ kind: 'eval', code });
    event.currentTarget.value = '';
  };

  // Collapsed to just its bar until opened.
  flexShrink: 0;
  position: relative;
  display: flex;
  flexDirection: column;
  borderTop: $colorFdBorder, 1;

  // Straddles the top edge; invisible until hovered, drags the drawer height.
  grip: {
    position: absolute;
    top: -3;
    left: 0;
    right: 0;
    height: 7;
    zIndex: 5;
    cursor: "row-resize";

    $hover: { background: $colorFdPrimary; }
  }

  // Header: collapse caret + Console/State tabs.
  bar: {
    display: flex;
    alignItems: stretch;

    caret: {
      padding: 6, 8;
      border: none;
      background: none;
      color: $colorFdMutedForeground;
      cursor: pointer;
    }

    tab: {
      padding: 6, 12;
      fontSize: 0.7;
      fontWeight: 600;
      textTransform: uppercase;
      letterSpacing: '0.06em';
      border: none;
      background: none;
      color: $colorFdMutedForeground;
      cursor: pointer;

      if("[aria-pressed='true']") {
        color: $colorFdForeground;
        boxShadow: `inset 0 -2px 0 var(--accent)`;
      }
    }
  }

  // Always mounted (only hidden when collapsed) so the console captures logs
  // from the first render, not just after it's opened.
  panel: {
    flexDirection: column;
    borderTop: $colorFdBorder, 1;
  }

  repl: {
    flexShrink: 0;
    borderTop: $colorFdBorder, 1;
    padding: 6, 10;
    fontFamily: "ui-monospace, monospace";
    fontSize: 0.8;
    color: $colorFdForeground;
    background: $colorFdBackground;
    border: none;
    outline: none;
  }

  return (
    <div>
      {showConsole && <div _grip onMouseDown={grabConsole} />}
      <div _bar>
        <button _caret onClick={() => toggle()}>{showConsole ? '▾' : '▸'}</button>
        <button _tab aria-pressed={tab === 'console'} onClick={() => open('console')}>
          Console
        </button>
        <button _tab aria-pressed={tab === 'state'} onClick={() => open('state')}>
          State
        </button>
      </div>
      <div _panel style={{ display: showConsole ? 'flex' : 'none', height: consoleHeight }}>
        <div
          style={{ display: tab === 'console' ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          <SandpackConsole showHeader={false} resetOnPreviewRestart style={{ flex: 1, minHeight: 0 }} />
          <input _repl onKeyDown={dispatch} />
        </div>
        {tab === 'state' && <Inspector />}
      </div>
    </div>
  );
}
