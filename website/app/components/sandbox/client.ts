import type {
  Command,
  CompleteResult,
  Detail,
  QuickInfo,
  Response,
} from './protocol';

export interface SandboxTs {
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
  const pending = new Map<number, (value: unknown) => void>();

  worker.addEventListener('message', ({ data }: MessageEvent<Response>) => {
    const resolve = pending.get(data.id);
    if (resolve) {
      pending.delete(data.id);
      resolve(data.result);
    }
  });

  const send = <T>(command: Command): Promise<T> =>
    new Promise<T>((resolve) => {
      const id = ++seq;
      pending.set(id, resolve as (value: unknown) => void);
      worker.postMessage({ ...command, id });
    });

  void send({ kind: 'init', files });

  return {
    sync(files) {
      void send({ kind: 'sync', files });
    },
    complete(path, code, pos) {
      return send({ kind: 'complete', path, code, pos });
    },
    details(path, pos, name, source, data) {
      return send({ kind: 'details', path, pos, name, source, data });
    },
    quickInfo(path, code, pos) {
      return send({ kind: 'quickInfo', path, code, pos });
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}
