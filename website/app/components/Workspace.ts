import State, { ref } from '@expressive/react';
import type { MouseEvent as ReactMouseEvent } from 'react';

export type Tab = 'console' | 'state';

// Each example remounts Workspace; remember the drawer's open state + tab
// module-side so a fresh instance restores the last choice.
const remembered = { open: false, tab: 'console' as Tab, height: 180 };

export default class Workspace extends State {
  mode: 'preview' | 'code' = 'preview';
  tab: Tab = remembered.tab;
  ratio = 50; // editor width (%) when both panels are side by side
  showConsole = remembered.open;
  consoleHeight = remembered.height; // console drawer height (px) when open

  // Wraps the preview; holds the sandbox iframe `send` talks to.
  frame = ref<HTMLDivElement>();

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

  // All parent -> sandbox traffic; the entry's message handler routes by `kind`.
  send(msg: Record<string, unknown>) {
    this.frame.current
      ?.querySelector('iframe')
      ?.contentWindow?.postMessage({ source: 'expressive', ...msg }, '*');
  }

  toggle() {
    this.showConsole = remembered.open = !this.showConsole;
  }

  open(tab: Tab) {
    this.tab = remembered.tab = tab;
    this.showConsole = remembered.open = true;
  }

  onSelect(is: typeof this.mode) {
    this.mode = is;
  }

  grab(event: ReactMouseEvent) {
    event.preventDefault();
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();

    onDrag('col-resize', (e) => {
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      this.ratio = Math.min(80, Math.max(20, pct));
    });
  }

  // Drag the drawer's top edge: up grows the console (eating preview height).
  grabConsole(event: ReactMouseEvent) {
    event.preventDefault();
    const startY = event.clientY;
    const start = this.consoleHeight;
    const column = this.frame.current?.getBoundingClientRect();
    const max = column ? column.height - 120 : 600;

    onDrag('row-resize', (e) => {
      const next = start + (startY - e.clientY);
      this.consoleHeight = remembered.height = Math.min(max, Math.max(80, next));
    });
  }
}

// A transparent shield over everything keeps mousemove firing in this
// document for the whole drag - otherwise the preview iframe swallows the
// events the moment the cursor crosses into it. Also pins the drag cursor.
function onDrag(cursor: string, move: (e: globalThis.MouseEvent) => void) {
  const shield = document.createElement('div');
  shield.style.cssText = `position:fixed;inset:0;z-index:9999;cursor:${cursor}`;
  document.body.appendChild(shield);

  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    shield.remove();
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
