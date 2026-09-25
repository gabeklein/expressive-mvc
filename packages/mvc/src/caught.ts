import type { State } from './state';

/**
 * Reported to `State.on({ catch })` handlers instead of being thrown or logged.
 * Unhandled, a `warning` goes to `console.warn`; anything else escapes uncaught.
 */
class Caught extends Error {
  /** Non-urgent - unhandled, it logs as a warning. */
  readonly warning: boolean = false;

  constructor(
    readonly state: State,
    message: string,
    readonly key?: string,
    cause?: unknown
  ) {
    super(message, cause ? { cause } : undefined);
  }

  /** A write to a destroyed state, dropped. */
  static Destroyed = class Destroyed extends Caught {
    readonly warning = true;

    constructor(state: State, key: string) {
      super(state, `Tried to update ${state}.${key} but state is destroyed.`, key);
    }
  };

  /** A state constructed but never activated. */
  static Inactive = class Inactive extends Caught {
    readonly warning = true;

    constructor(state: State) {
      super(state, `${state} was constructed but never activated.`);
    }
  };

  /** A getter threw while refreshing; `cause` is what it threw. */
  static Getter = class Getter extends Caught {
    constructor(state: State, key: string, cause: unknown) {
      super(state, `An exception was thrown while refreshing ${state}.${key}.`, key, cause);
    }
  };

  /** An async initializer rejected; `cause` is the rejection. */
  static Init = class Init extends Caught {
    constructor(state: State, cause: unknown) {
      super(state, `Async error in constructor for ${state}.`, undefined, cause);
    }
  };

  /** An effect or listener threw during a dispatch flush; `cause` is what it threw. */
  static Effect = class Effect extends Caught {
    constructor(state: State, cause: unknown) {
      super(state, `An exception was thrown by an effect of ${state}.`, undefined, cause);
    }
  };
}

declare namespace Caught {
  type Destroyed = InstanceType<typeof Caught.Destroyed>;
  type Inactive = InstanceType<typeof Caught.Inactive>;
  type Getter = InstanceType<typeof Caught.Getter>;
  type Init = InstanceType<typeof Caught.Init>;
  type Effect = InstanceType<typeof Caught.Effect>;
}

export { Caught };
