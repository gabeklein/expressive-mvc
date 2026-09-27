import { dispatch, type Call } from '../dispatch';
import type { Frame, Options } from '../journal';

export interface Hot {
  on(event: string, listener: (data: any) => unknown): void;
  send(event: string, data?: unknown): void;
}

export interface Ask {
  rid: number;
  call?: Call;
}

async function around(step: unknown) {
  if (!Array.isArray(step) || typeof step[0] != 'string')
    throw new Error('around takes one call: ["around", [method, ...args]].');

  let value: unknown;
  const frames = (await dispatch([
    ['act'],
    [
      async () => {
        value = await dispatch([step[0].split('.'), step.slice(1)]);
      }
    ]
  ])) as Frame[];

  return { value: value ?? null, frames };
}

export function connect(hot: Hot) {
  const id = Math.random().toString(36).slice(2, 8);
  const record = (...options: Options[]) => dispatch([['journal', 'record'], options]) as Required<Options>;

  if (record().level === 'off') record({ level: 'keys' });

  hot.on('expressive-inspect:ask', async ({ rid, call }: Ask) => {
    try {
      const value = !call
        ? { id, url: location.href, title: document.title, top: window.self === window.top }
        : call[0].join('.') == 'around'
          ? await around(call[1][0])
          : await dispatch(call);

      hot.send('expressive-inspect:answer', { rid, value: JSON.parse(JSON.stringify(value) ?? 'null') });
    } catch (error) {
      hot.send('expressive-inspect:answer', { rid, error: error instanceof Error ? error.message : String(error) });
    }
  });

  hot.send('expressive-inspect:hello', { id });
}
