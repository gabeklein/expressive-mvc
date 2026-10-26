import {
  SandpackCodeEditor,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from '@codesandbox/sandpack-react';
import Model, { Component, ref, set } from '@expressive/react';
import { Columns2, PanelLeftOpen, Rows2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import CodeLabel from './CodeLabel';
import { createSandboxTs, type SandboxTs } from './sandbox/client';
import { intellisense } from './sandbox/intellisense';

declare const __SANDBOX_DEPS__: Record<string, string>;

type Files = Record<string, string | { code: string }>;

interface SandboxProps {
  name: string;
  label: string;
  files: Record<string, string>;
  navigationOpen?: boolean;
  onOpenNavigation?: () => void;
}

export default function Sandbox(props: SandboxProps) {
  const { resolvedTheme } = useTheme();

  return <Workspace {...props} dark={resolvedTheme === 'dark'} />;
}

class Workspace extends Component {
  name = '';
  label = '';
  files: Files = {};
  dark = false;
  navigationOpen = false;
  onOpenNavigation?: () => void = undefined;

  // Owned here, not by the provider below: a theme toggle remounts the provider,
  // and respawning the worker would leave IntelliSense cold.
  ts = languageService(() => this.files);

  new() {
    return () => this.ts.dispose();
  }

  // Each example declares its own @expressive/* deps via its imports, pinned to
  // the workspace at build time.
  get dependencies() {
    const deps: Record<string, string> = {};

    for (const entry of Object.values(this.files)) {
      const code = typeof entry === 'string' ? entry : entry.code;

      for (const [pkg] of code.matchAll(/@expressive\/[a-z-]+/g)) {
        const version = __SANDBOX_DEPS__[pkg];

        if (!version)
          throw new Error(`${pkg} is not a published package - a sandbox example cannot import it.`);

        deps[pkg] = version;
      }
    }

    return deps;
  }

  // The preview is a cross-origin iframe; bake the theme into the hidden entry,
  // which global.css honors via :root[data-theme].
  get themed(): Files {
    const entry = this.files['/index.tsx'];
    const line = `\ndocument.documentElement.dataset.theme = ${JSON.stringify(this.dark ? 'dark' : 'light')};`;

    return {
      ...this.files,
      '/index.tsx':
        typeof entry === 'string'
          ? entry + line
          : { ...entry, code: entry.code + line },
    };
  }

  render() {
    const { name, dark, themed, dependencies } = this;

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
}

function languageService(source: () => Files) {
  let client: SandboxTs | undefined;

  return {
    ensure() {
      if (!client) {
        const files: Record<string, string> = {};

        for (const [path, entry] of Object.entries(source()))
          files[path] = typeof entry === 'string' ? entry : entry.code;

        client = createSandboxTs(files);
      }

      return client;
    },
    sync(next: Record<string, string>) {
      client?.sync(next);
    },
    dispose() {
      client?.dispose();
      client = undefined;
    },
  };
}

class Layout extends Component {
  mode: 'preview' | 'code' = 'preview';
  stacked = false;
  ratio = 50;
  dragging = false;
  tabs: HTMLElement | null = null;
  media = new MediaQuery({ query: '(max-width: 639px)' });

  layout = ref<HTMLDivElement>((el) => {
    // Hold Ctrl and two-finger swipe to nudge split
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      this.ratio = Math.min(80, Math.max(20, this.ratio - delta * 0.05));
    };

    // Sandpack renders its tab strip late; track it as a portal target.
    const findTabs = () => {
      this.tabs = el.querySelector<HTMLElement>('.sp-tabs-scrollable-container');
    };

    const observer = new MutationObserver(findTabs);

    findTabs();
    observer.observe(el, { childList: true, subtree: true });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      observer.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  });

  get narrow() {
    return this.media.matches;
  }

  // Below the breakpoint the panels can't fit side by side; show one at a time.
  get showEditor() {
    return !this.narrow || this.mode === 'code';
  }

  get showPreview() {
    return !this.narrow || this.mode === 'preview';
  }

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

    this.dragging = true;

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
      this.dragging = false;
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

  render() {
    const {
      layout,
      mode,
      narrow,
      onSelect,
      ratio,
      showPreview,
      stacked,
      toggleSplit,
    } = this;

    return (
      <SandpackLayout
        ref={layout}
        style={{ flexDirection: stacked ? 'column' : 'row' }}
        className="relative h-full [--sp-layout-height:100%]">
        <Editor />
        <NavigationButton />
        {!narrow && <Divider />}
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
}

function Editor() {
  const { ts } = Workspace.get();
  const { narrow, ratio, showEditor } = Layout.get();
  const sandpack = useSandpack();
  const { files, activeFile } = sandpack.sandpack;
  const activeFileRef = useRef(activeFile);

  activeFileRef.current = activeFile;

  useEffect(() => {
    const out: Record<string, string> = {};
    for (const [path, file] of Object.entries(files)) out[path] = file.code;
    ts.sync(out);
  }, [files, ts]);

  const extensions = useMemo(
    () => [intellisense(() => ts.ensure(), () => activeFileRef.current)],
    [ts],
  );

  const refreshOnSave = {
    key: 'Mod-s',
    preventDefault: true,
    run() {
      sandpack.dispatch({ type: 'refresh' });
      return true;
    },
  };

  return (
    <SandpackCodeEditor
      showLineNumbers
      style={{
        display: showEditor ? 'flex' : 'none',
        flex: narrow ? '1' : `0 0 ${ratio}%`,
      }}
      extensions={extensions}
      extensionsKeymap={[refreshOnSave]}
    />
  );
}

function NavigationButton() {
  const { label, navigationOpen, onOpenNavigation } = Workspace.get();
  const { tabs } = Layout.get();

  if (!onOpenNavigation || navigationOpen || !tabs) return null;

  return createPortal(
    <button
      aria-label={`Open examples navigation for ${label.replace(/`/g, '')}`}
      className="order-first mr-1 flex max-w-56 shrink-0 items-center gap-1.5 self-stretch pr-4 pl-3 text-sm font-medium text-fd-muted-foreground hover:text-fd-foreground"
      onClick={onOpenNavigation}>
      <PanelLeftOpen className="size-4 shrink-0" />
      <span className="truncate">
        <CodeLabel label={label} />
      </span>
    </button>,
    tabs
  );
}

function Divider() {
  const { adjust, dragging, grab, ratio, stacked } = Layout.get();

  return (
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
      {dragging && (
        <div
          className={`fixed inset-0 z-50 ${
            stacked ? 'cursor-row-resize' : 'cursor-col-resize'
          }`}
        />
      )}
    </div>
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

class MediaQuery extends Model {
  matches = false;

  query = set('', (value) => {
    const media = window.matchMedia(value);
    const update = () => (this.matches = media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
}
