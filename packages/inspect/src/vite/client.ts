import { dispatch, type Call } from '../dispatch';

export interface Hot {
  on(event: string, listener: (data: any) => unknown): void;
  send(event: string, data?: unknown): void;
}

export interface Ask {
  rid: number;
  call?: Call;
}

export function connect(hot: Hot) {
  const id = Math.random().toString(36).slice(2, 8);

  hot.on('expressive-inspect:ask', async ({ rid, call }: Ask) => {
    try {
      const value = call
        ? await dispatch(call)
        : { id, url: location.href, title: document.title, top: window.self === window.top };

      hot.send('expressive-inspect:answer', { rid, value: JSON.parse(JSON.stringify(value) ?? 'null') });
    } catch (error) {
      hot.send('expressive-inspect:answer', { rid, error: error instanceof Error ? error.message : String(error) });
    }
  });

  hot.send('expressive-inspect:hello', { id });
}
