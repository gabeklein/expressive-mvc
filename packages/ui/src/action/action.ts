import Model from '@expressive/mvc';

declare namespace Action {
  type Handler = () => unknown;
}

/**
 * Async gate. Wraps a handler so that it cannot re-enter while in flight,
 * exposes `pending` for the duration, and captures a thrown error instead of
 * letting it escape.
 *
 * This is the state LFCP reimplemented three times with `useState` - in Button,
 * in Dialog's confirm prompt, and in ConfirmButton.
 */
class Action extends Model {
  pending = false;
  error?: Error = undefined;

  /** Non-null when the last run produced a value. */
  done = false;

  handler?: Action.Handler = undefined;

  /** Whether the gate will accept a call right now. */
  get ready() {
    return !this.pending && !!this.handler;
  }

  async run() {
    const { handler } = this;

    if (this.pending || !handler) return;

    this.pending = true;
    this.error = undefined;
    this.done = false;

    try {
      const result = await handler();

      this.done = true;

      return result;
    } catch (error) {
      this.error =
        error instanceof Error ? error : new Error(String(error));
    } finally {
      this.pending = false;
    }
  }

  dismiss() {
    this.error = undefined;
  }
}

export { Action };
