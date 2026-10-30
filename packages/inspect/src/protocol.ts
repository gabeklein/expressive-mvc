import { bracket } from './bracket';
import { dispatch, type Call } from './dispatch';
import type { Options, Query } from './journal';
import { tick, type Act } from './settle';

export const CALL_TIMEOUT = 10000;

export type Answer = { value?: unknown; error?: string; status?: number };

const FOREIGN = ['origin', 'sec-fetch-site', 'forwarded', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'];
const LOOPBACK = /^((::ffff:)?127(\.\d{1,3}){3}|::1)$/;
const MISSING = Symbol.for('expressive-inspect.missing');
const FAILED = 'Call failed.';

export function local(ip: string | null | undefined, headers: { has(name: string): boolean }) {
  return !FOREIGN.some((header) => headers.has(header)) && LOOPBACK.test(ip ?? '');
}

export function parse(text: string): Call | undefined {
  try {
    const input: unknown = JSON.parse(text);

    if (Array.isArray(input) && typeof input[0] == 'string') return [input[0].split('.'), input.slice(1)];
  } catch {}
}

export const journalCall = (method: string, ...args: unknown[]) => dispatch([['journal', method], args]) as any;

async function act(step: unknown, options?: Act) {
  if (!Array.isArray(step) || typeof step[0] != 'string')
    throw new Error('act takes one call: ["act", [method, ...args], options?].');

  const remote = {
    record: (...options: Options[]) => journalCall('record', ...options),
    seq: () => journalCall('seq'),
    frames: (query: Query) => journalCall('frames', query),
    get: (address: string) => dispatch([['get'], [address]])
  };

  const { value, frames, settled, pending, missing } = await bracket(remote, () => dispatch([step[0].split('.'), step.slice(1)]), tick, options, true);

  return { value: value ?? null, frames, settled, pending, missing };
}

export async function answer(call: Call): Promise<Answer> {
  try {
    const value = call[0].join('.') == 'act' ? await act(call[1][0], call[1][1] as Act) : await dispatch(call);

    return { value: JSON.parse(JSON.stringify(value) ?? 'null') };
  } catch (error) {
    if (!(error instanceof Error)) return { error: String(error) || FAILED };

    return { error: error.message || FAILED, status: MISSING in error ? 404 : undefined };
  }
}
