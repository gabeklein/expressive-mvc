import type { State } from './state';

const about = (cause: unknown) => {
  const text = cause instanceof Error ? cause.message : String(cause);
  return text ? `: ${text}` : '.';
};

/**
 * Reported to `State.on({ catch })` handlers instead of being thrown or logged.
 * Unhandled, a `warning` goes to `console.warn`; anything else escapes uncaught.
 */
class Caught extends Error {
  readonly name: string = 'Caught';

  /** Non-urgent - unhandled, it logs as a warning. */
  readonly warning: boolean = false;

  declare readonly state: State;

  constructor(
    state: State,
    message: string,
    readonly key?: string,
    cause?: unknown
  ) {
    super(message, arguments.length > 3 ? { cause } : undefined);
    Object.defineProperty(this, 'state', { value: state });
  }

  /** A `catch` handler logging what would otherwise escape uncaught; warnings pass on. */
  static log(error: Caught): Caught | void {
    if (error.warning) return error;
    console.error(error);
  }

  /** A write to a destroyed state - stored without dispatch, so the writer reads it back. */
  static Destroyed = class Destroyed extends Caught {
    readonly name = 'Caught.Destroyed';
    readonly warning = true;

    constructor(state: State, key: string) {
      super(state, `Tried to update ${state}.${key} but state is destroyed.`, key);
    }
  };

  /** A state constructed but never activated. */
  static Inactive = class Inactive extends Caught {
    readonly name = 'Caught.Inactive';
    readonly warning = true;

    constructor(state: State) {
      super(state, `${state} was constructed but never activated.`);
    }
  };

  /** A getter threw while refreshing; `cause` is what it threw. */
  static Getter = class Getter extends Caught {
    readonly name = 'Caught.Getter';

    constructor(state: State, key: string, cause: unknown) {
      super(state, `An exception was thrown while refreshing ${state.constructor}.${key}${about(cause)}`, key, cause);
    }
  };

  /** An async initializer rejected; `cause` is the rejection. */
  static Init = class Init extends Caught {
    readonly name = 'Caught.Init';

    constructor(state: State, cause: unknown) {
      super(state, `Async error in constructor for ${state.constructor}${about(cause)}`, undefined, cause);
    }
  };

  /** An effect or listener threw during a dispatch flush; `cause` is what it threw. */
  static Effect = class Effect extends Caught {
    readonly name = 'Caught.Effect';

    constructor(state: State, cause: unknown) {
      super(state, `An exception was thrown by an effect of ${state.constructor}${about(cause)}`, undefined, cause);
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
