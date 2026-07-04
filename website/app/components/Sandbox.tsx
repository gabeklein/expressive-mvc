import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react';
import State, { ref } from '@expressive/react';
import { useTheme } from 'next-themes';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

class Panes extends State {
  mode: 'preview' | 'code' = 'preview';
  ratio = 50; // editor width (%) when both panels are side by side

  // Hold Ctrl and two-finger swipe to nudge split
  layout = ref<HTMLDivElement>((el) => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.ratio = Math.min(80, Math.max(20, this.ratio - delta * 0.05));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  onSelect(is: typeof this.mode) {
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
  files,
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
      '/index.tsx':
        typeof entry === 'string'
          ? entry + line
          : { ...entry, code: entry.code + line },
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
  const { onSelect, mode, ratio, grab, layout } = Panes.use();
  const sandpack = useSandpack();
  const refreshOnSave = {
    key: 'Mod-s',
    preventDefault: true,
    run() {
      sandpack.dispatch({ type: 'refresh' });
      return true;
    },
  };

  // Below the breakpoint the panels can't fit side by side; show one at a time
  // and reveal a toggle. Inline display wins over Sandpack's own layout CSS.
  const narrow = useMediaQuery('(max-width: 767px)');
  const showEditor = !narrow || mode === 'code';
  const showPreview = !narrow || mode === 'preview';

  return (
    <SandpackLayout
      ref={layout}
      className="relative h-full [--sp-layout-height:100%]">
      <SandpackCodeEditor
        style={{
          display: showEditor ? 'flex' : 'none',
          flex: narrow ? '1' : `0 0 ${ratio}%`,
        }}
        extensionsKeymap={[refreshOnSave]}
      />
      {!narrow && (
        <div
          className="shrink-0 w-1.5 cursor-col-resize bg-fd-border hover:bg-fd-primary"
          onMouseDown={grab}
        />
      )}
      <SandpackPreview
        style={{ display: showPreview ? 'flex' : 'none', flex: '1 1 0%' }}
      />
      {narrow && <Switcher panel={mode} onSelect={onSelect} />}
    </SandpackLayout>
  );
}

function Switcher({
  panel,
  onSelect,
}: {
  panel: 'preview' | 'code';
  onSelect: (v: 'preview' | 'code') => void;
}) {
  const button =
    'px-2.5 py-1 text-xs rounded border-none bg-transparent text-fd-muted-foreground cursor-pointer aria-pressed:bg-fd-muted aria-pressed:text-fd-foreground';

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-0.5 p-0.5 rounded-md border border-fd-border bg-fd-background">
      <button
        className={button}
        aria-pressed={panel === 'code'}
        onClick={() => onSelect('code')}>
        Code
      </button>
      <button
        className={button}
        aria-pressed={panel === 'preview'}
        onClick={() => onSelect('preview')}>
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
