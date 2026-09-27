import type { Evaluates } from './bridge';

/** An entry of a CDP endpoint's `/json/list`. */
export interface Target {
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

type Reply = {
  error?: { message: string };
  result?: { result: { value?: unknown }; exceptionDetails?: { text: string; exception?: { description?: string } } };
};

const describe = (targets: Target[]) => targets.map((target) => `\n  ${target.type} ${target.title} ${target.url}`).join('');

/**
 * Connect to a Chrome DevTools Protocol endpoint - a Node process under `--inspect`, or a browser with a
 * debug port - as an `evaluate` target for `inspect()`. `pick` narrows `/json/list` by predicate, or by a
 * string matched against title and URL; more than one match throws with the list. A `ws://` URL connects directly.
 */
export async function devtools(
  endpoint = 'http://127.0.0.1:9229',
  pick?: string | ((target: Target) => boolean)
): Promise<Evaluates & { close(): void }> {
  let url = endpoint;

  if (!endpoint.startsWith('ws')) {
    const targets = ((await (await fetch(`${endpoint}/json/list`)).json()) as Target[]).filter((target) => target.webSocketDebuggerUrl);
    const match =
      typeof pick == 'string' ? (target: Target) => target.title.includes(pick) || target.url.includes(pick) : pick;
    const found = match ? targets.filter(match) : targets;

    if (found.length !== 1)
      throw new Error(
        found.length
          ? `Several debug targets at ${endpoint} - narrow with pick, e.g. (t) => t.type === 'page' && t.url.includes('…'):${describe(found)}`
          : `No debug target at ${endpoint}${typeof pick == 'string' ? ` matches "${pick}"` : pick ? ' matches pick' : ''}.${describe(targets)}`
      );

    url = found[0].webSocketDebuggerUrl!;
  }

  const socket = new WebSocket(url);
  const waiting = new Map<number, (reply: Reply) => void>();
  let id = 0;

  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error(`Could not connect to ${url}.`));
  });

  socket.onmessage = ({ data }) => {
    const reply = JSON.parse(String(data));
    waiting.get(reply.id)?.(reply);
    waiting.delete(reply.id);
  };

  socket.onclose = () => {
    for (const settle of waiting.values()) settle({ error: { message: 'Debug connection closed.' } });
    waiting.clear();
  };

  return {
    async evaluate(fn, arg) {
      const { error, result } = await new Promise<Reply>((resolve) => {
        waiting.set(++id, resolve);
        socket.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true }
          })
        );
      });

      if (error) throw new Error(error.message);

      const { exceptionDetails } = result!;

      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);

      return result!.result.value;
    },
    close() {
      socket.close();
    }
  };
}
