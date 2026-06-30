import State from '@expressive/react';

// Most async work has the same shape - we wait for a response, get
// something back, sometimes get an error. Query handles that scaffolding
// so any specific endpoint only plugs in the part that's actually different.

export abstract class Query extends State {
  // Three flags covering the lifecycle of a request.
  // A component reading any of these refreshes when it changes.
  response?: any = undefined;
  error?: Error = undefined;
  waiting = false;

  // Subclasses supply the actual fetch. Whatever you return
  // becomes `response`; throw to populate `error`.
  abstract request(): Promise<any>;

  // Call `run()` to kick things off. Assignments to `this` along the
  // way refresh anyone subscribed - no manual notify, no setState.
  async run() {
    this.waiting = true;

    try {
      this.response = await this.request();
    } catch (error) {
      if (error instanceof Error) this.error = error;
    } finally {
      this.waiting = false;
    }
  }

  reset() {
    this.response = undefined;
    this.error = undefined;
  }
}
