import type { State } from './state';

/**
 * Reported to `State.on({ catch })` handlers instead of being thrown or logged.
 * Unhandled, a `warning` goes to `console.warn`, anything else to `console.error`.
 */
class Error extends globalThis.Error {
  /** Non-urgent - unhandled, it logs as a warning. */
  declare readonly warning: boolean;

  constructor(
    readonly state: State,
    message: string,
    readonly key?: string,
    cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
  }

  /** A write to a destroyed state, dropped. */
  static Destroyed = kind(this, true);

  /** A state constructed but never activated. */
  static Inactive = kind(this, true);

  /** A getter threw while refreshing; `cause` is what it threw. */
  static Getter = kind(this, false);

  /** An async initializer rejected; `cause` is the rejection. */
  static Init = kind(this, false);

  /** An effect or listener threw during a dispatch flush; `cause` is what it threw. */
  static Effect = kind(this, false);
}

function kind(Base: typeof Error, warning: boolean) {
  class Kind extends Base {}

  Object.defineProperty(Kind.prototype, 'warning', { value: warning });

  return Kind;
}

declare namespace Error {
  type Destroyed = InstanceType<typeof Error.Destroyed>;
  type Inactive = InstanceType<typeof Error.Inactive>;
  type Getter = InstanceType<typeof Error.Getter>;
  type Init = InstanceType<typeof Error.Init>;
  type Effect = InstanceType<typeof Error.Effect>;
}

export { Error };
