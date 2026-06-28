import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import State from '@expressive/react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import type { MouseEvent as ReactMouseEvent } from 'react';

class Panes extends State {
  panel: 'preview' | 'code' = 'preview';
  ratio = 50; // editor width (%) when both panels are side by side

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
  const { theme } = useTheme();

  return (
    <SandpackProvider
      key={name}
      theme={theme === 'dark' ? 'dark' : 'light'}
      template="react-ts"
      files={files}
      customSetup={{
        dependencies: { '@expressive/react': 'latest' }
      }}
      style={{ height: '100%' }}>
      <Layout />
    </SandpackProvider>
  );
}

function Layout() {
  const { dispatch } = useSandpack();
  const panes = Panes.use();
  const { panel, ratio, grab } = panes;

  // Below the breakpoint the panels can't fit side by side; show one at a time
  // and reveal a toggle. Inline display wins over Sandpack's own layout CSS.
  const narrow = useMediaQuery('(max-width: 767px)');
  const showEditor = !narrow || panel === 'code';
  const showPreview = !narrow || panel === 'preview';

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

  return (
    <SandpackLayout>
      <SandpackCodeEditor
        style={{ display: showEditor ? 'flex' : 'none', flex: narrow ? '1' : `0 0 ${ratio}%` }}
        extensionsKeymap={[
          {
            key: 'Mod-s',
            preventDefault: true,
            run() {
              dispatch({ type: 'refresh' });
              return true;
            }
          }
        ]}
      />
      {!narrow && <div _handle onMouseDown={grab} />}
      <SandpackPreview style={{ display: showPreview ? 'flex' : 'none', flex: '1 1 0%' }} />
      {narrow && (
        <Switcher panel={panel} onSelect={(value) => (panes.panel = value)} />
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
