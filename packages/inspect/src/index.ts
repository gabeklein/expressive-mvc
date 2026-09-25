import { attach, call, detach, find, get, health, Instance, instances, models, orphans, roots, set, tree, wrapAll } from './inspect';
import { act, journal as base, type Options } from './journal';
import { label, resolve } from './types';

export type { Health, Model, Node } from './inspect';
export type { Event, Frame, Level, Options, Query } from './journal';
export type { TypeInfo } from './types';
export { Instance, act, attach, call, detach, find, get, health, instances, label, models, orphans, resolve, roots, set, tree };
export { parsePath, serialize } from './serialize';

export const journal = {
  ...base,
  record(options?: Options) {
    const config = base.record(options);
    if (config.calls && config.level !== 'off') wrapAll();
    return config;
  }
};

export const inspect = {
  attach,
  detach,
  find,
  instances,
  roots,
  orphans,
  health,
  models,
  tree,
  get,
  set,
  call,
  act,
  label,
  resolve,
  journal
};

declare global {
  var __EXPRESSIVE_INSPECT__: typeof inspect | undefined;
}

export default inspect;
