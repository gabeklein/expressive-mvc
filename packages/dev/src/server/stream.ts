import { connect, listen } from "./connection";

export const STREAM = "/.expressive/stream";

export function isStream(request: Request): boolean {
  return request.method === "GET" && new URL(request.url).pathname === STREAM;
}

export function stream(request: Request): Response {
  const connection = connect(new URL(request.url).searchParams.get("connection"));

  if (!connection) return new Response(null, { status: 400 });

  const encode = new TextEncoder();
  let close: (() => void) | undefined;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      close = listen(connection, (event, data) => controller.enqueue(encode.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)));

      request.signal.addEventListener("abort", () => {
        if (!close) return;
        close();
        close = undefined;
        controller.close();
      });
    },
    cancel() {
      close?.();
      close = undefined;
    },
  });

  return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
}
