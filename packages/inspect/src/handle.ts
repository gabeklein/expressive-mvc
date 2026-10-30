import { answer, CALL_TIMEOUT, local, parse, type Answer } from './protocol';

const USAGE = 'GET describes this process; POST with [method, ...args] calls the inspector.';

/** Serve an installed inspector over HTTP, to loopback callers only. */
export async function handle(req: Request, { ip }: { ip: string | null | undefined }): Promise<Response> {
  if (!globalThis.__EXPRESSIVE_INSPECT__) return Response.json({ error: 'Inspector not installed.' }, { status: 404 });

  if (!local(ip, req.headers))
    return Response.json({ error: 'Local callers only; browser and proxied requests are refused.' }, { status: 403 });

  if (req.method === 'GET') return Response.json(identity());
  if (req.method !== 'POST') return Response.json({ error: USAGE }, { status: 405 });

  const call = parse(await req.text().catch(() => ''));

  if (!call) return Response.json({ error: 'Body must be a JSON array: [method, ...args].' }, { status: 400 });

  let timer: Parameters<typeof clearTimeout>[0];
  const expire = new Promise<undefined>((resolve) => (timer = setTimeout(resolve, CALL_TIMEOUT)));
  const reply: Answer | undefined = await Promise.race([answer(call), expire]);

  clearTimeout(timer);

  if (!reply) return Response.json({ error: 'Call did not answer.' }, { status: 504 });
  if (reply.error) return Response.json({ error: reply.error }, { status: reply.status ?? 500 });

  return Response.json(reply.value);
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
