import { answer, local, parse } from './protocol';

const USAGE = 'GET describes this process; POST with [method, ...args] calls the inspector.';

/** Serve an installed inspector over HTTP, to loopback callers only. */
export async function handler(req: Request, { ip }: { ip: string | null | undefined }): Promise<Response> {
  if (!globalThis.__EXPRESSIVE_INSPECT__) return Response.json({ error: 'Inspector not installed.' }, { status: 404 });

  if (!local(ip, req.headers))
    return Response.json({ error: 'Local callers only; browser and proxied requests are refused.' }, { status: 403 });

  if (req.method === 'GET') return Response.json(identity());
  if (req.method !== 'POST') return Response.json({ error: USAGE }, { status: 405 });

  const call = parse(await req.text());

  if (!call) return Response.json({ error: 'Body must be a JSON array: [method, ...args].' }, { status: 400 });

  const { value, error, status } = await answer(call);

  return error ? Response.json({ error }, { status: status ?? 500 }) : Response.json(value);
}

function identity() {
  const { process, Bun, Deno } = globalThis as { process?: any; Bun?: unknown; Deno?: { pid: number } };
  const runtime = Bun ? 'bun' : Deno ? 'deno' : process?.versions?.node ? 'node' : 'unknown';

  return { process: true, pid: process?.pid ?? Deno?.pid ?? null, runtime, title: process?.title ?? null };
}
