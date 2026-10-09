import { Component } from "@expressive/mvc";

import { add, fail, reset } from "./api";

export class Page extends Component {
  shown = "";

  async run(task: () => Promise<unknown>) {
    try {
      this.shown = String(await task());
    } catch (error) {
      this.shown = (error as Error).message;
    }
  }

  render() {
    const { shown, run } = this;

    return (
      <>
        <h1>Tally</h1>
        <button onClick={() => run(() => add(1))}>Add</button>
        <button onClick={() => run(reset)}>Reset</button>
        <button onClick={() => run(fail)}>Fail</button>
        <output>{shown}</output>
      </>
    );
  }
}
