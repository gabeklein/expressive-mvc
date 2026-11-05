import { Component } from "@expressive/mvc";
import { HttpError } from "@expressive/rpc";

import { Closed, Overflow, add, close, fail, reset, where } from "./remote";

export class Page extends Component {
  shown = "";

  async run(task: () => Promise<unknown>) {
    try {
      this.shown = String(await task());
    } catch (error) {
      if (error instanceof Overflow) this.shown = `Overflow at ${error.limit}`;
      else if (error instanceof Closed && error instanceof HttpError) this.shown = `HttpError ${error.status}: ${error.message}`;
      else this.shown = (error as Error).message;
    }
  }

  render() {
    const { shown, run } = this;

    return (
      <>
        <h1>Tally</h1>
        <button onClick={() => run(() => add(1))}>Add</button>
        <button onClick={() => run(() => add(10))}>Add 10</button>
        <button onClick={() => run(reset)}>Reset</button>
        <button onClick={() => run(fail)}>Fail</button>
        <button onClick={() => run(where)}>Where</button>
        <button onClick={() => run(close)}>Close</button>
        <output>{shown}</output>
      </>
    );
  }
}
