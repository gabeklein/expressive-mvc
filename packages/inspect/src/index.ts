import { attach, call, detach, get, models, set, tree, wrapAll } from './inspect';
import { journal as base, type Options } from './journal';

export type { Model, Node } from './inspect';
export type { Event, Frame, Level, Options, Query } from './journal';
export { attach, call, detach, get, models, set, tree };
export { parsePath, serialize } from './serialize';

export const journal = {
  ...base,
  record(options?: Options) {
    const config = base.record(options);
    if (config.calls && config.level !== 'off') wrapAll();
    return config;
  }
};

export const inspect = { attach, detach, models, tree, get, set, call, journal };

export default inspect;
