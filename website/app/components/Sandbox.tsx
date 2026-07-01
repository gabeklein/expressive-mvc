import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import { Provider } from '@expressive/react';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';

import Panel from './Panel';
import { Panel as Split } from './layout/Layout';
import Workspace from './Workspace';

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
      <Provider for={Workspace}>
        <Layout />
      </Provider>
    </SandpackProvider>
  );
}

function Layout() {
  const { grab, layout, frame, mode, onSelect, ratio, showConsole } = Workspace.get();
  const sandpack = useSandpack();

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

  // Right column: preview on top, console drawer beneath it. When open, a
  // Control split makes the boundary draggable; collapsed stays a flat column.
  preview: {
    flexDirection: column;
    flex: '1 1 0%';
    minWidth: 0;
  }

  return (
    <SandpackLayout ref={layout}>
      <SandpackCodeEditor
        style={{ display: showEditor ? 'flex' : 'none', flex: narrow ? '1' : `0 0 ${ratio}%` }}
        extensionsKeymap={[refreshOnSave]}
      />
      {!narrow && <div _handle onMouseDown={grab} />}
      <div _preview ref={frame} style={{ display: showPreview ? 'flex' : 'none' }}>
        {!narrow && showConsole ? (
          <Split>
            <SandpackPreview style={{ height: '100%', minHeight: 0 }} />
            <Panel fill />
          </Split>
        ) : (
          <>
            <SandpackPreview style={{ flex: '1 1 0%' }} />
            <Panel />
          </>
        )}
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
