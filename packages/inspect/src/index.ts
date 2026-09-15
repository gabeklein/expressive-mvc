import { attach, call, detach, find, get, Handle, handles, models, roots, set, tree, wrapAll } from './inspect';
import { act, journal as base, type Options } from './journal';
import { label, resolve } from './types';

export type { Model, Node } from './inspect';
export type { Event, Frame, Level, Options, Query } from './journal';
export type { TypeInfo } from './types';
export { Handle, act, attach, call, detach, find, get, handles, label, models, resolve, roots, set, tree };
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
  handles,
  roots,
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

export default inspect;
