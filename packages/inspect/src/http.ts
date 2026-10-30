import './install';
import { answer, body, CALL_TIMEOUT, headers, local, parse, reply, type Answer, type NodeRequest, type NodeResponse } from './protocol';

/** Where the caller's address comes from: given outright, Bun's `server`, or Deno's `info`. */
type Source =
  | { ip: string | null | undefined }
  | { requestIP(req: Request): { address: string } | null }
  | { remoteAddr: { hostname: string } };

type Result = [status: number, data: unknown];

const USAGE = 'GET describes this process; POST with [method, ...args] calls the inspector.';

/** Serve an installed inspector over HTTP, to loopback callers only. */
export function handle(req: Request, source: Source): Promise<Response>;
export function handle(req: NodeRequest, res: NodeResponse): Promise<void>;
export async function handle(req: Request | NodeRequest, second: Source | NodeResponse) {
  if (typeof (second as NodeResponse).end == 'function') {
    const node = req as NodeRequest;
    const text = () => body(node).then((text) => text || (Array.isArray(node.body) ? JSON.stringify(node.body) : ''));
    const [status, data] = await respond(node.method, node.socket?.remoteAddress, headers(node), text);

    return reply(second as NodeResponse, status, data);
  }

  const web = req as Request;
  const [status, data] = await respond(web.method, address(web, second as Source), web.headers, () => web.text());

  return Response.json(data, { status });
}

function address(req: Request, source: Source) {
  if ('ip' in source) return source.ip;
  if ('requestIP' in source) return source.requestIP(req)?.address;
  if ('remoteAddr' in source) return source.remoteAddr.hostname;
}

async function respond(
  method: string | undefined,
  ip: string | null | undefined,
  headers: { has(name: string): boolean },
  text: () => Promise<string>
): Promise<Result> {
  if (!globalThis.__EXPRESSIVE_INSPECT__) return [404, { error: 'Inspector not installed.' }];
  if (!local(ip, headers)) return [403, { error: 'Local callers only; browser and proxied requests are refused.' }];
  if (method === 'GET') return [200, identity()];
  if (method !== 'POST') return [405, { error: USAGE }];

  const call = parse(await text().catch(() => ''));

  if (!call) return [400, { error: 'Body must be a JSON array: [method, ...args].' }];

  let timer: Parameters<typeof clearTimeout>[0];
  const expire = new Promise<undefined>((resolve) => (timer = setTimeout(resolve, CALL_TIMEOUT)));
  const result: Answer | undefined = await Promise.race([answer(call), expire]);

  clearTimeout(timer);

  if (!result) return [504, { error: 'Call did not answer.' }];
  if (result.error) return [result.status ?? 500, { error: result.error }];

  return [200, result.value];
}

function identity() {
  const process = (globalThis as { process?: { pid?: number; title?: string; cwd?(): string } }).process;

  return {
    process: true,
    pid: process?.pid ?? null,
    cwd: process?.cwd?.() ?? null,
    started: Math.round(performance.timeOrigin),
    runtime: globalThis.navigator?.userAgent ?? null,
    title: process?.title ?? null
  };
}
