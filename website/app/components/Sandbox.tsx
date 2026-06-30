import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import State, { ref } from '@expressive/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import type { MouseEvent as ReactMouseEvent } from 'react';

class Panes extends State {
  mode: 'preview' | 'code' = 'preview';
  ratio = 50; // editor width (%) when both panels are side by side
  showConsole = false;

  toggleConsole() {
    this.showConsole = !this.showConsole;
  }

  // Hold Ctrl and two-finger swipe to nudge split
  layout = ref<HTMLDivElement>((el) => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.ratio = Math.min(80, Math.max(20, this.ratio - delta * 0.05));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  onSelect(is: typeof this.mode){
    this.mode = is;
  }

  grab(event: ReactMouseEvent) {
    event.preventDefault();
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();

    const move = (e: globalThis.MouseEvent) => {
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      this.ratio = Math.min(80, Math.max(20, pct));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
}

export default function Sandbox({
  name,
  files
}: {
  name: string;
  files: Record<string, string>;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  // Each example declares its own @expressive/* deps via its imports - scan
  // the source so router (or any future package) resolves without a hardcoded list.
  const dependencies = useMemo(() => {
    const deps: Record<string, string> = {};

    for (const entry of Object.values(files) as (string | { code: string })[]) {
      const code = typeof entry === 'string' ? entry : entry.code;
      for (const [pkg] of code.matchAll(/@expressive\/[a-z-]+/g))
        deps[pkg] = 'latest';
    }

    return deps;
  }, [files]);

  // The preview is a cross-origin Sandpack iframe, so we can't set its theme
  // from here - bake it into the hidden entry, which global.css honors via
  // :root[data-theme]. Keyed into the provider so a toggle re-applies it.
  const themed = useMemo(() => {
    const entry = files['/index.tsx'] as string | { code: string };
    const line = `\ndocument.documentElement.dataset.theme = ${JSON.stringify(dark ? 'dark' : 'light')};`;

    return {
      ...files,
      '/index.tsx': typeof entry === 'string' ? entry + line : { ...entry, code: entry.code + line }
    };
  }, [files, dark]);

  return (
    <SandpackProvider
      key={`${name}:${dark ? 'dark' : 'light'}`}
      theme={dark ? 'dark' : 'light'}
      template="react-ts"
      files={themed}
      customSetup={{ dependencies }}
      style={{ height: '100%' }}>
      <Layout />
    </SandpackProvider>
  );
}

function Layout() {
  const { onSelect, mode, ratio, grab, layout, showConsole, toggleConsole } = Panes.use();
  const sandpack = useSandpack();
  const preview = useRef<HTMLDivElement>(null);

  // Send a REPL line into the preview iframe; the sandbox entry evals it and
  // echoes the result back through the console channel.
  const dispatch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const code = event.currentTarget.value.trim();
    if (!code) return;
    preview.current
      ?.querySelector('iframe')
      ?.contentWindow?.postMessage({ source: 'expressive-repl', code }, '*');
    event.currentTarget.value = '';
  };

  const refreshOnSave = {
    key: 'Mod-s',
    preventDefault: true,
    run() {
      sandpack.dispatch({ type: 'refresh' });
      return true;
    }
  }

  // Below the breakpoint the panels can't fit side by side; show one at a time
  // and reveal a toggle. Inline display wins over Sandpack's own layout CSS.
  const narrow = useMediaQuery('(max-width: 767px)');
  const showEditor = !narrow || mode === 'code';
  const showPreview = !narrow || mode === 'preview';

  position: relative;
  height: '100%';
  $spLayoutHeight: '100%';

  handle: {
    flexShrink: 0;
    width: 6;
    cursor: "col-resize";
    background: $colorFdBorder;

    $hover: {
      background: $colorFdPrimary;
    }
  }

  // Right column: preview on top, console drawer beneath it - the console
  // eats into the preview's height only, leaving the editor full-height.
  preview: {
    flexDirection: column;
    flex: '1 1 0%';
    minWidth: 0;
  }

  // Collapsed to just its toggle bar until opened.
  console: {
    flexShrink: 0;
    display: flex;
    flexDirection: column;
    borderTop: $colorFdBorder, 1;
  }

  toggle: {
    display: flex;
    alignItems: center;
    gap: 6;
    padding: 6, 12;
    fontSize: 0.7;
    fontWeight: 600;
    textTransform: uppercase;
    letterSpacing: '0.06em';
    textAlign: left;
    color: $colorFdMutedForeground;
    background: $colorFdBackground;
    border: none;
    cursor: pointer;

    $hover: {
      color: $colorFdForeground;
    }
  }

  // Always mounted (only hidden when collapsed) so the console captures logs
  // from the first render, not just after it's opened.
  panel: {
    height: 180;
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
    <SandpackLayout ref={layout}>
      <SandpackCodeEditor
        style={{ display: showEditor ? 'flex' : 'none', flex: narrow ? '1' : `0 0 ${ratio}%` }}
        extensionsKeymap={[refreshOnSave]}
      />
      {!narrow && <div _handle onMouseDown={grab} />}
      <div _preview ref={preview} style={{ display: showPreview ? 'flex' : 'none' }}>
        <SandpackPreview style={{ flex: '1 1 0%' }} />
        <div _console>
          <button _toggle onClick={toggleConsole}>
            {showConsole ? '▾' : '▸'} Console
          </button>
          <div _panel style={{ display: showConsole ? 'flex' : 'none' }}>
            <SandpackConsole showHeader={false} resetOnPreviewRestart style={{ flex: 1, minHeight: 0 }} />
            <input _repl placeholder="› counter.current = 10" onKeyDown={dispatch} />
          </div>
        </div>
      </div>
      {narrow && (
        <Switcher panel={mode} onSelect={onSelect} />
      )}
    </SandpackLayout>
  );
}

function Switcher({
  panel,
  onSelect
}: {
  panel: 'preview' | 'code';
  onSelect: (v: 'preview' | 'code') => void;
}) {
  position: absolute;
  top: 8;
  right: 8;
  zIndex: 10;
  display: flex;
  gap: 2;
  padding: 2;
  borderRadius: 6;
  border: $colorFdBorder;
  background: $colorFdBackground;

  button: {
    padding: 4, 10;
    fontSize: 0.75;
    borderRadius: 4;
    border: none;
    background: none;
    color: $colorFdMutedForeground;
    cursor: pointer;

    if("[aria-pressed='true']") {
      background: $colorFdMuted;
      color: $colorFdForeground;
    }
  }

  return (
    <div>
      <button _button aria-pressed={panel === 'code'} onClick={() => onSelect('code')}>
        Code
      </button>
      <button _button aria-pressed={panel === 'preview'} onClick={() => onSelect('preview')}>
        Preview
      </button>
    </div>
  );
}

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatch(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);

  return match;
}
