import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack
} from '@codesandbox/sandpack-react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

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
  const [view, setView] = useState<'preview' | 'code'>('preview');

  // Below the breakpoint the panels can't fit side by side; show one at a time
  // and reveal a toggle. Inline display wins over Sandpack's own layout CSS.
  const narrow = useMediaQuery('(max-width: 767px)');
  const showEditor = !narrow || view === 'code';
  const showPreview = !narrow || view === 'preview';

  position: relative;
  height: '100%';
  $spLayoutHeight: '100%';

  return (
    <SandpackLayout>
      <SandpackCodeEditor
        style={{ display: showEditor ? 'flex' : 'none' }}
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
      <SandpackPreview style={{ display: showPreview ? 'flex' : 'none' }} />
      {narrow && <Switcher view={view} setView={setView} />}
    </SandpackLayout>
  );
}

function Switcher({
  view,
  setView
}: {
  view: 'preview' | 'code';
  setView: (v: 'preview' | 'code') => void;
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
      <button _button aria-pressed={view === 'code'} onClick={() => setView('code')}>
        Code
      </button>
      <button _button aria-pressed={view === 'preview'} onClick={() => setView('preview')}>
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
