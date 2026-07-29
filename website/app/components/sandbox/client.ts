import type {
  Command,
  CompleteResult,
  Detail,
  QuickInfo,
  Response,
} from './protocol';

export interface SandboxTs {
  /** Resolves once the worker's language service has loaded its libs. */
  whenReady: Promise<void>;
  sync(files: Record<string, string>): void;
  complete(
    path: string,
    code: string,
    pos: number,
  ): Promise<CompleteResult | null>;
  details(
    path: string,
    pos: number,
    name: string,
    source: string | undefined,
    data: unknown,
  ): Promise<Detail | null>;
  quickInfo(
    path: string,
    code: string,
    pos: number,
  ): Promise<QuickInfo | null>;
  dispose(): void;
}

/**
 * Spawns the TypeScript language service in a worker and exposes it as a set of
 * promise-returning calls. The worker owns `typescript` and every acquired
 * `.d.ts`, so none of that touches the main thread - only file text out and
 * plain result objects back.
 */
export function createSandboxTs(files: Record<string, string>): SandboxTs {
  const worker = new Worker(
    new URL('./tsserver.worker.ts', import.meta.url),
    { type: 'module' },
  );

  let seq = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  const failAll = (error: Error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
  };

  worker.addEventListener('message', ({ data }: MessageEvent<Response>) => {
    const slot = pending.get(data.id);
    if (!slot) return;
    pending.delete(data.id);
    if (data.error) slot.reject(new Error(data.error));
    else slot.resolve(data.result);
  });

  // A worker that dies (load error, crash) would otherwise leave every caller
  // hanging forever; reject them so failures surface instead of stalling.
  worker.addEventListener('error', (e) =>
    failAll(new Error(e.message || 'sandbox language-service worker error')),
  );
  worker.addEventListener('messageerror', () =>
    failAll(new Error('sandbox language-service message error')),
  );

  const send = <T>(command: Command): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = ++seq;
      pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      worker.postMessage({ ...command, id });
    });

  // A failed language service should degrade to "no completions", never a
  // hang or an unhandled rejection - callers treat null as "nothing to offer".
  const safe = <T>(command: Command): Promise<T | null> =>
    send<T>(command).catch((error) => {
      console.warn('[sandbox] IntelliSense request failed:', error);
      return null;
    });

  const whenReady = send({ kind: 'init', files }).then(
    () => undefined,
    (error) => {
      console.warn('[sandbox] IntelliSense failed to start:', error);
    },
  );

  return {
    whenReady,
    sync(files) {
      void safe({ kind: 'sync', files });
    },
    complete(path, code, pos) {
      return safe({ kind: 'complete', path, code, pos });
    },
    details(path, pos, name, source, data) {
      return safe({ kind: 'details', path, pos, name, source, data });
    },
    quickInfo(path, code, pos) {
      return safe({ kind: 'quickInfo', path, code, pos });
    },
    dispose() {
      worker.terminate();
      failAll(new Error('sandbox language service disposed'));
    },
  };
}
