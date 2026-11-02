import type { Call } from '../dispatch';
import { answer, journalCall } from '../protocol';

export interface Hot {
  on(event: string, listener: (data: any) => unknown): void;
  send(event: string, data?: unknown): void;
}

export interface Ask {
  rid: number;
  call?: Call;
}

const RELOAD = '@expressive/inspect.reload';

/** Keep a reload's reason past the reload, for the next page's journal. */
function remember(reason: unknown) {
  try {
    sessionStorage.setItem(RELOAD, JSON.stringify(reason));
  } catch {}
}

function recall() {
  try {
    const reason = sessionStorage.getItem(RELOAD);

    if (reason === null) return;

    sessionStorage.removeItem(RELOAD);
    return JSON.parse(reason);
  } catch {}
}

export function connect(hot: Hot) {
  const id = Math.random().toString(36).slice(2, 8);

  if (journalCall('record').level === 'off') journalCall('record', { level: 'keys' });

  const reloaded = recall();

  if (reloaded) journalCall('hot', 'reload', reloaded);

  hot.on('vite:beforeUpdate', ({ updates }: { updates: { path: string }[] }) => {
    journalCall('hot', 'update', updates.map((update) => update.path));
  });

  hot.on('vite:beforeFullReload', ({ path, triggeredBy }: { path?: string; triggeredBy?: string } = {}) => {
    remember({ path, triggeredBy });
  });

  globalThis.addEventListener?.('expressive:reload', (event) => remember((event as CustomEvent).detail));

  hot.on('expressive-inspect:ask', async ({ rid, call }: Ask) => {
    const reply = call
      ? await answer(call)
      : { value: { id, url: location.href, title: document.title, top: window.self === window.top } };

    hot.send('expressive-inspect:answer', { rid, ...reply });
  });

  hot.send('expressive-inspect:hello', { id });
}
