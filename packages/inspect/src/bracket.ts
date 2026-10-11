import type { Frame, Options, Query } from './journal';
import { SETTLE_TIMEOUT, settle, type Act } from './settle';

export interface Remote {
  record(options?: Options): Required<Options> | Promise<Required<Options>>;
  seq(): number | Promise<number>;
  frames(query: Query): Frame[] | Promise<Frame[]>;
  get(address: string): unknown;
}

/** Resolve `address.key` to the instance `address` names - label, id, or owner path - so frames match it alone. */
/** Resolve `address.key` to the instance `address` names - label, id, or owner path - as the `id.key` its frames carry. */
async function locate(remote: Remote, target: string) {
  const dot = target.lastIndexOf('.');

  if (target[dot + 1] == '_')
    throw new Error(`until ${target}: _ keys are unmanaged and emit no events - wait on a value instead.`);
  const found = (await remote.get(target.slice(0, dot))) as { $ref?: string } | undefined;

  if (!found?.$ref) throw new Error(`until ${target}: ${target.slice(0, dot)} names no State.`);

  return `${found.$ref}.${target.slice(dot + 1)}`;
}

/**
 * Run `step` recording values, wait for `until`, settle, and return what it produced; the prior recording is restored.
 * `local` steps run here, so activity for `until` counts once their synchronous writes flush, not once they resolve.
 */
export async function bracket(
  remote: Remote,
  step: () => unknown,
  wait: () => unknown,
  { until = [], timeout = SETTLE_TIMEOUT, record }: Act = {},
  local?: boolean
) {
  const before = await remote.record();
  const since = await remote.seq();
  const window = { ...before, ...record };
  const filtered = window.types.length + window.paths.length + window.keys.length > 0;
  const values = typeof until == 'string' || Array.isArray(until) ? undefined : until;
  const addresses = values ? [] : ([] as string[]).concat(until as string | string[]);
  const paths = filtered ? [...window.paths, ...addresses.filter((address) => address.indexOf('.') === address.lastIndexOf('.'))] : [];

  await remote.record({ ...record, level: 'values', ...(filtered && { paths }) });

  try {
    const running = step();
    let from: number | undefined;

    if (local) {
      await undefined;
      from = await remote.seq();
    }

    const value = await running;

    from ??= await remote.seq();
    const end = Date.now() + timeout;
    const pending = new Set(values ? Object.keys(values) : addresses);
    const targets = new Map<string, string>();

    for (const address of addresses) targets.set(address, await locate(remote, address));

    if (filtered && addresses.some((address) => address.indexOf('.') !== address.lastIndexOf('.')))
      await remote.record({ paths: [...paths, ...targets.values()] });

    while (pending.size) {
      if (values) {
        for (const address of pending)
          if (JSON.stringify(await remote.get(address)) === JSON.stringify(values[address])) pending.delete(address);
      } else
        for (const frame of await remote.frames({ since: from }))
          for (const event of frame.events)
            for (const address of pending) if (targets.get(address) === `${event.id}.${event.key}`) pending.delete(address);

      if (!pending.size || Date.now() >= end) break;

      await wait();
    }

    const settled = !pending.size && (await settle(remote.seq, wait, Math.max(0, end - Date.now())));
    const missing: string[] = [];

    if (values)
      for (const address of pending)
        if ((await remote.get(address.slice(0, address.lastIndexOf('.')))) === undefined) missing.push(address);

    return { value, frames: await remote.frames({ since }), settled, pending: [...pending], missing, timeout };
  } finally {
    await remote.record(before);
  }
}
