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

/**
 * Connect to a Chrome DevTools Protocol endpoint - a Node process under `--inspect`, or a browser with a
 * debug port - as an `evaluate` target for `inspect()`. Takes the first target `pick` accepts, or a
 * `ws://` debugger URL directly.
 */
export async function cdp(
  endpoint = 'http://127.0.0.1:9229',
  pick: (target: Target) => boolean = () => true
): Promise<Evaluates & { close(): void }> {
  const url = endpoint.startsWith('ws')
    ? endpoint
    : ((await (await fetch(`${endpoint}/json/list`)).json()) as Target[]).find(
        (target) => target.webSocketDebuggerUrl && pick(target)
      )?.webSocketDebuggerUrl;

  if (!url) throw new Error(`No debug target at ${endpoint}.`);

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
