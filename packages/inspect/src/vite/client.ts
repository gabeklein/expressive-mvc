import { dispatch, type Call } from '../dispatch';
import { bracket } from '../bracket';
import type { Options, Query } from '../journal';
import { tick, type Act } from '../settle';

export interface Hot {
  on(event: string, listener: (data: any) => unknown): void;
  send(event: string, data?: unknown): void;
}

export interface Ask {
  rid: number;
  call?: Call;
}

const journal = (method: string, ...args: unknown[]) => dispatch([['journal', method], args]) as any;

async function act(step: unknown, options?: Act) {
  if (!Array.isArray(step) || typeof step[0] != 'string')
    throw new Error('act takes one call: ["act", [method, ...args], options?].');

  const remote = {
    record: (...options: Options[]) => journal('record', ...options),
    seq: () => journal('seq'),
    frames: (query: Query) => journal('frames', query),
    get: (address: string) => dispatch([['get'], [address]])
  };

  const { value, frames, settled, pending, missing } = await bracket(remote, () => dispatch([step[0].split('.'), step.slice(1)]), tick, options, true);

  return { value: value ?? null, frames, settled, pending, missing };
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

  if (journal('record').level === 'off') journal('record', { level: 'keys' });

  const reloaded = recall();

  if (reloaded) journal('hot', 'reload', reloaded);

  hot.on('vite:beforeUpdate', ({ updates }: { updates: { path: string }[] }) => {
    journal('hot', 'update', updates.map((update) => update.path));
  });

  hot.on('vite:beforeFullReload', ({ path, triggeredBy }: { path?: string; triggeredBy?: string } = {}) => {
    remember({ path, triggeredBy });
  });

  globalThis.addEventListener?.('expressive:reload', (event) => remember((event as CustomEvent).detail));

  hot.on('expressive-inspect:ask', async ({ rid, call }: Ask) => {
    try {
      const value = !call
        ? { id, url: location.href, title: document.title, top: window.self === window.top }
        : call[0].join('.') == 'act'
          ? await act(call[1][0], call[1][1] as Act)
          : await dispatch(call);

      hot.send('expressive-inspect:answer', { rid, value: JSON.parse(JSON.stringify(value) ?? 'null') });
    } catch (error) {
      hot.send('expressive-inspect:answer', { rid, error: error instanceof Error ? error.message : String(error) });
    }
  });

  hot.send('expressive-inspect:hello', { id });
}
