import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, WebSocketClient, WebSocketServer } from 'vite';

import type { Call } from '../dispatch';

const VIRTUAL = 'virtual:expressive-inspect';
const RESOLVED = '\0' + VIRTUAL;
const DEPS = ['@expressive/inspect/install', '@expressive/inspect/vite/client'];

const SOURCE = `import '@expressive/inspect/install';
import { connect } from '@expressive/inspect/vite/client';
if (import.meta.hot) connect(import.meta.hot);
`;

export const LIST_TIMEOUT = 1000;
export const CALL_TIMEOUT = 10000;

const USAGE = 'GET /__inspect lists pages; POST /__inspect/:id with [method, ...args] calls one.';

export function plugin(url: string): Plugin {
  let base = '/';

  return {
    name: 'expressive-inspect',
    apply: 'serve',
    config() {
      if (url.includes('/node_modules/')) return { optimizeDeps: { include: DEPS } };
    },
    configResolved(config) {
      base = config.base;
    },
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
    },
    load(id) {
      if (id === RESOLVED) return SOURCE;
    },
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `${base}@id/${VIRTUAL}` },
          injectTo: 'head-prepend'
        }
      ];
    },
    configureServer(server) {
      server.middlewares.use('/__inspect', relay(server.ws));
    }
  };
}

type Answer = { value?: unknown; error?: string };

export function relay(ws: Pick<WebSocketServer, 'on' | 'clients'>) {
  const pages = new Map<string, WebSocketClient>();
  const pending = new Map<number, (answer: Answer) => void>();
  let next = 0;

  ws.on('expressive-inspect:hello', ({ id }: { id: string }, client: WebSocketClient) => {
    pages.set(id, client);
  });

  ws.on('expressive-inspect:answer', ({ rid, ...answer }: Answer & { rid: number }) => {
    pending.get(rid)?.(answer);
  });

  function ask(client: WebSocketClient, call: Call | undefined, timeout: number) {
    return new Promise<Answer | undefined>((resolve) => {
      const rid = ++next;
      const timer = setTimeout(settle, timeout);

      function settle(answer?: Answer) {
        clearTimeout(timer);
        pending.delete(rid);
        resolve(answer);
      }

      pending.set(rid, settle);
      client.send('expressive-inspect:ask', { rid, call });
    });
  }

  function live() {
    const open = ws.clients;

    for (const [id, client] of pages) if (!open.has(client)) pages.delete(id);

    return pages;
  }

  async function list() {
    const answers = await Promise.all([...live().values()].map((client) => ask(client, undefined, LIST_TIMEOUT)));

    return answers.flatMap((answer) => (answer && !answer.error ? [answer.value] : []));
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (!local(req)) return reply(res, 403, { error: 'Local callers only; browser and proxied requests are refused.' });

    const id = decodeURIComponent(req.url!.split('?')[0].slice(1));

    if (req.method === 'GET' && !id) return reply(res, 200, await list());
    if (req.method !== 'POST') return reply(res, 405, { error: USAGE });

    const call = parse(await body(req));

    if (!call) return reply(res, 400, { error: 'Body must be a JSON array: [method, ...args].' });

    const open = live();
    const client = id ? open.get(id) : open.size === 1 ? [...open.values()][0] : undefined;

    if (!client) {
      const error = id ? `No page ${id}.` : open.size ? 'Several pages connected - POST /__inspect/:id.' : 'No pages connected.';
      return reply(res, !id && open.size ? 409 : 404, { error, pages: await list() });
    }

    const answer = await ask(client, call, CALL_TIMEOUT);

    if (!answer) return reply(res, 504, { error: 'Page did not answer.' });
    if (answer.error) return reply(res, 500, { error: answer.error });

    reply(res, 200, answer.value);
  };
}

const FOREIGN = ['origin', 'sec-fetch-site', 'forwarded', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];

function local(req: IncomingMessage) {
  return (
    !FOREIGN.some((header) => header in req.headers) &&
    /^(::ffff:)?127\.|^::1$/.test(req.socket.remoteAddress ?? '')
  );
}

function parse(text: string): Call | undefined {
  try {
    const input: unknown = JSON.parse(text);

    if (Array.isArray(input) && typeof input[0] == 'string') return [input[0].split('.'), input.slice(1)];
  } catch {}
}

async function body(req: IncomingMessage) {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text;
}

function reply(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data ?? null));
}
