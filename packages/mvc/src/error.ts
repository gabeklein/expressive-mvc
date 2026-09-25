import type { State } from './state';

/**
 * Reported to `State.on({ catch })` handlers instead of being thrown or logged.
 * Unhandled, a `warning` goes to `console.warn`; anything else escapes uncaught.
 */
class Error extends globalThis.Error {
  /** Non-urgent - unhandled, it logs as a warning. */
  readonly warning: boolean = false;

  constructor(
    readonly state: State,
    message: string,
    readonly key?: string,
    cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
  }

  /** A write to a destroyed state, dropped. */
  static Destroyed = class Destroyed extends Error {
    readonly warning = true;

    constructor(state: State, key: string) {
      super(state, `Tried to update ${state}.${key} but state is destroyed.`, key);
    }
  };

  /** A state constructed but never activated. */
  static Inactive = class Inactive extends Error {
    readonly warning = true;

    constructor(state: State) {
      super(state, `${state} was constructed but never activated.`);
    }
  };

  /** A getter threw while refreshing; `cause` is what it threw. */
  static Getter = class Getter extends Error {
    constructor(state: State, key: string, cause: unknown) {
      super(state, `An exception was thrown while refreshing ${state}.${key}.`, key, cause);
    }
  };

  /** An async initializer rejected; `cause` is the rejection. */
  static Init = class Init extends Error {
    constructor(state: State, cause: unknown) {
      super(state, `Async error in constructor for ${state}.`, undefined, cause);
    }
  };

  /** An effect or listener threw during a dispatch flush; `cause` is what it threw. */
  static Effect = class Effect extends Error {
    constructor(state: State, cause: unknown) {
      super(state, `An exception was thrown by an effect of ${state}.`, undefined, cause);
    }
  };
}

declare namespace Error {
  type Destroyed = InstanceType<typeof Error.Destroyed>;
  type Inactive = InstanceType<typeof Error.Inactive>;
  type Getter = InstanceType<typeof Error.Getter>;
  type Init = InstanceType<typeof Error.Init>;
  type Effect = InstanceType<typeof Error.Effect>;
}

export { Error };
