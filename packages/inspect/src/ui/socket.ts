import type { Call } from '../dispatch';
import type { PageInfo } from './remote';

type Answer = { value?: unknown; error?: string };

export interface Connection {
  /** Forward a Call to `target` - or, with no call, ask for the page roster. */
  send(call?: Call, target?: string): Promise<unknown>;
  /** Page roster pushes - join, hello, disconnect. A `{ error }` payload means the join was refused. */
  watch(fn: (pages: PageInfo[] | { error: string }) => void): void;
  close(): void;
}

export interface Boot {
  /** Relay join token, embedded in the served page. */
  token?: string;
  /** Vite's webSocketToken - the browser upgrade is refused without it. */
  ws?: string;
  base?: string;
}

/** A devtools client on the dev server's HMR socket - raw `vite-hmr` protocol, no vite client. */
export function connectWs(boot: Boot): Connection {
  const { token = '', ws = '', base = '/' } = boot;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${base}?token=${ws}`;
  const socket = new WebSocket(url, 'vite-hmr');
  const pending = new Map<number, (answer: Answer) => void>();
  const watchers = new Set<(pages: PageInfo[] | { error: string }) => void>();
  let rid = 0;

  const open = new Promise<void>((resolve, reject) => {
    socket.onopen = () => {
      emit('expressive-inspect:join', { token });
      resolve();
    };
    socket.onerror = () => reject(new Error(`Could not reach the dev server socket at ${url}.`));
  });

  socket.onclose = () => {
    for (const settle of pending.values()) settle({ error: 'Socket closed.' });
    pending.clear();
  };

  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.type !== 'custom') return;

    if (message.event === 'expressive-inspect:answer') {
      const { rid, ...answer } = message.data;
      pending.get(rid)?.(answer);
      pending.delete(rid);
    } else if (message.event === 'expressive-inspect:pages') {
      for (const watch of watchers) watch(message.data);
    }
  };

  function emit(event: string, data?: unknown) {
    socket.send(JSON.stringify({ type: 'custom', event, data }));
  }

  return {
    async send(call?: Call, target?: string) {
      await open;
      const answer = await new Promise<Answer>((resolve) => {
        pending.set(++rid, resolve);
        emit('expressive-inspect:forward', { rid, target, call });
      });
      if (answer.error) throw new Error(answer.error);
      return answer.value;
    },
    watch(fn) {
      watchers.add(fn);
    },
    close() {
      socket.close();
    }
  };
}
