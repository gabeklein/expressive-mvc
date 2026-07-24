import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react';
import State, { ref, set } from '@expressive/react';
import { Columns2, PanelLeftOpen, Rows2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { createSandboxTs, type SandboxTs } from './sandbox/client';
import { intellisense } from './sandbox/intellisense';

class Panes extends State {
  mode: 'preview' | 'code' = 'preview';
  stacked = false;
  ratio = 50;

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

  toggleSplit() {
    this.stacked = !this.stacked;
  }

  grab(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;

    event.preventDefault();
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    const pointerId = event.pointerId;

    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      const pct = this.stacked
        ? ((e.clientY - rect.top) / rect.height) * 100
        : ((e.clientX - rect.left) / rect.width) * 100;
      this.ratio = Math.min(80, Math.max(20, pct));
    };
    const up = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    };

    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  adjust(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 2;

    const decrease = this.stacked ? 'ArrowUp' : 'ArrowLeft';
    const increase = this.stacked ? 'ArrowDown' : 'ArrowRight';

    if (event.key === decrease) this.ratio = Math.max(20, this.ratio - step);
    else if (event.key === increase)
      this.ratio = Math.min(80, this.ratio + step);
    else if (event.key === 'Home') this.ratio = 20;
    else if (event.key === 'End') this.ratio = 80;
    else return;

    event.preventDefault();
  }
}

export default function Sandbox({
  name,
  label,
  files,
  navigationOpen = false,
  onOpenNavigation,
}: {
  name: string;
  label: string;
  files: Record<string, string>;
  navigationOpen?: boolean;
  onOpenNavigation?: () => void;
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
      <Layout
        label={label}
        navigationOpen={navigationOpen}
        onOpenNavigation={onOpenNavigation}
      />
    </SandpackProvider>
  );
}

function Layout({
  label,
  navigationOpen,
  onOpenNavigation,
}: {
  label: string;
  navigationOpen: boolean;
  onOpenNavigation?: () => void;
}) {
  const {
    onSelect,
    mode,
    stacked,
    ratio,
    grab,
    adjust,
    toggleSplit,
    layout,
  } = Panes.use();
  const [layoutElement, setLayoutElement] = useState<HTMLDivElement | null>(
    null
  );
  const [tabs, setTabs] = useState<HTMLElement | null>(null);
  const connectLayout = useCallback(
    (element: HTMLDivElement | null) => {
      layout(element);
      setLayoutElement(element);
    },
    [layout]
  );
  useEffect(() => {
    if (!layoutElement) {
      setTabs(null);
      return;
    }

    const update = () =>
      setTabs(
        layoutElement.querySelector<HTMLElement>(
          '.sp-tabs-scrollable-container'
        )
      );
    const observer = new MutationObserver(update);

    update();
    observer.observe(layoutElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [layoutElement]);
  const sandpack = useSandpack();
  const refreshOnSave = {
    key: 'Mod-s',
    preventDefault: true,
    run() {
      sandpack.dispatch({ type: 'refresh' });
      return true;
    },
  };

  // A per-sandbox TS language service (in a worker) powers editor completions
  // and hovers. It's spawned on first use - not mount - so the heavy chunk
  // stays off the critical path; once alive it's kept fed as files change.
  const { files, activeFile } = sandpack.sandpack;
  const clientRef = useRef<SandboxTs | undefined>(undefined);
  const activeFileRef = useRef(activeFile);
  const filesRef = useRef(files);
  activeFileRef.current = activeFile;
  filesRef.current = files;

  const asSource = (source: typeof files) => {
    const out: Record<string, string> = {};
    for (const [path, file] of Object.entries(source)) out[path] = file.code;
    return out;
  };

  const ensureClient = useCallback(() => {
    if (!clientRef.current)
      clientRef.current = createSandboxTs(asSource(filesRef.current));
    return clientRef.current;
  }, []);

  useEffect(() => {
    clientRef.current?.sync(asSource(files));
  }, [files]);

  useEffect(
    () => () => {
      clientRef.current?.dispose();
      clientRef.current = undefined;
    },
    [],
  );

  const extensions = useMemo(
    () => [intellisense(ensureClient, () => activeFileRef.current)],
    [ensureClient],
  );

  // Below the breakpoint the panels can't fit side by side; show one at a time
  // and reveal a toggle. Inline display wins over Sandpack's own layout CSS.
  const { matches: narrow } = MediaQuery.use({ query: '(max-width: 639px)' });
  const showEditor = !narrow || mode === 'code';
  const showPreview = !narrow || mode === 'preview';

  return (
    <SandpackLayout
      ref={connectLayout}
      style={{ flexDirection: stacked ? 'column' : 'row' }}
      className="relative h-full [--sp-layout-height:100%]">
      <SandpackCodeEditor
        showLineNumbers
        style={{
          display: showEditor ? 'flex' : 'none',
          flex: narrow ? '1' : `0 0 ${ratio}%`,
        }}
        extensions={extensions}
        extensionsKeymap={[refreshOnSave]}
      />
      {onOpenNavigation &&
        !navigationOpen &&
        tabs &&
        createPortal(
          <button
            aria-label={`Open examples navigation for ${label}`}
            className="order-first mr-1 flex max-w-40 shrink-0 items-center gap-1.5 self-stretch pr-4 pl-3 text-sm font-medium text-fd-muted-foreground hover:text-fd-foreground"
            onClick={onOpenNavigation}>
            <PanelLeftOpen className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>,
          tabs
        )}
      {!narrow && (
        <div
          role="separator"
          aria-label="Resize code and preview panels"
          aria-orientation={stacked ? 'horizontal' : 'vertical'}
          aria-valuemin={20}
          aria-valuemax={80}
          aria-valuenow={Math.round(ratio)}
          tabIndex={0}
          className={`group relative z-10 shrink-0 touch-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fd-ring ${
            stacked
              ? '-my-4 h-11 w-full cursor-row-resize'
              : '-mx-4 h-full w-11 cursor-col-resize'
          }`}
          onPointerDown={grab}
          onKeyDown={adjust}>
          <span
            className={`pointer-events-none absolute bg-fd-border transition-colors group-hover:bg-fd-primary group-focus-visible:bg-fd-primary ${
              stacked
                ? 'inset-x-0 top-1/2 h-px -translate-y-1/2'
                : 'inset-y-0 left-1/2 w-px -translate-x-1/2'
            }`}
          />
          <span
            className={`pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 rounded-full border border-fd-border bg-fd-background shadow-sm transition-colors group-hover:border-fd-primary group-focus-visible:border-fd-primary ${
              stacked ? 'h-1.5 w-12' : 'h-12 w-1.5'
            }`}
          />
        </div>
      )}
      <SandpackPreview
        style={{ display: showPreview ? 'flex' : 'none', flex: '1 1 0%' }}
      />
      {!narrow && (
        <SplitSwitcher
          stacked={stacked}
          ratio={ratio}
          onToggle={toggleSplit}
        />
      )}
      {narrow && <Switcher panel={mode} onSelect={onSelect} />}
    </SandpackLayout>
  );
}

function SplitSwitcher({
  stacked,
  ratio,
  onToggle,
}: {
  stacked: boolean;
  ratio: number;
  onToggle: () => void;
}) {
  const label = stacked ? 'Split panels vertically' : 'Split panels horizontally';

  return (
    <div
      className="absolute right-2 z-20 flex rounded-md border border-fd-border bg-fd-background p-0.5 shadow-sm"
      style={{ top: stacked ? `calc(${ratio}% + 1.25rem)` : '0.5rem' }}>
      <button
        type="button"
        aria-label={label}
        title={label}
        className="flex size-9 cursor-pointer items-center justify-center rounded border-none bg-transparent text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
        onClick={onToggle}>
        {stacked ? <Columns2 className="size-4" /> : <Rows2 className="size-4" />}
      </button>
    </div>
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

class MediaQuery extends State {
  matches = false;

  query = set('', (value) => {
    const media = window.matchMedia(value);
    const update = () => (this.matches = media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
}
