import { Component, get } from "@expressive/mvc";

import Counter from "./remote";

export class Page extends Component {
  counter = get(Counter);
  shown = "";

  async increment() {
    this.shown = String(await this.counter.increment());
  }

  async reset() {
    await this.counter.reset();
    this.shown = "0";
  }

  render() {
    const { shown, increment, reset } = this;

    return (
      <>
        <h1>Counter</h1>
        <button onClick={increment}>Increment</button>
        <button onClick={reset}>Reset</button>
        <output>{shown}</output>
      </>
    );
  }
}
