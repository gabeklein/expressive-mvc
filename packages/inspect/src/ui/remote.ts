import type { Call } from '../dispatch';
import type { Health, ModelInfo, Node } from '../inspect';
import type { Frame, Options, Query } from '../journal';
import type { Limits, Select } from '../serialize';

export type Send = (call?: Call) => Promise<unknown>;

export interface PageInfo {
  id: string;
  url: string;
  title: string;
  top: boolean;
}

/** One channel to a page's `__EXPRESSIVE_INSPECT__` - a Call in, a JSON-safe value out. */
export function remote(send: Send) {
  const call =
    <R>(...path: string[]) =>
    (...args: unknown[]) =>
      send([path, args]) as Promise<R>;

  return {
    get: call<unknown>('get') as (address?: string, select?: Select, limits?: Limits) => Promise<unknown>,
    set: call<void>('set') as (address: string, value: unknown) => Promise<void>,
    call: call<unknown>('call') as (address: string, ...args: unknown[]) => Promise<unknown>,
    models: call<ModelInfo[]>('models'),
    tree: call<Node[]>('tree'),
    health: call<Health>('health'),
    journal: {
      record: call<Required<Options>>('journal', 'record') as (options?: Options) => Promise<Required<Options>>,
      seq: call<number>('journal', 'seq'),
      frames: call<Frame[]>('journal', 'frames') as (query?: Query) => Promise<Frame[]>,
      clear: call<void>('journal', 'clear')
    }
  };
}

export type Remote = ReturnType<typeof remote>;
