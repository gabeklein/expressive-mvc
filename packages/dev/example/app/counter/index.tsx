import { Component, get } from "@expressive/mvc";

import Remote from "./remote";

export class Page extends Component {
  remote = get(Remote);
  current = 0;

  async increment() {
    this.current = await this.remote.increment();
  }

  async reset() {
    await this.remote.reset();
    this.current = 0;
  }

  render() {
    const { current, increment, reset } = this;

    return (
      <>
        <h1>Counter</h1>
        <button onClick={increment}>Increment</button>
        <button onClick={reset}>Reset</button>
        <output>{current}</output>
      </>
    );
  }
}
