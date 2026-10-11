import { Component, get } from "@expressive/mvc";

import Remote from "./remote";

export class Page extends Component {
  remote = get(Remote);

  render() {
    const { remote } = this;

    return (
      <>
        <h1>Counter</h1>
        <button onClick={() => remote.increment()}>Increment</button>
        <button onClick={() => remote.reset()}>Reset</button>
        <output>{remote.count}</output>
      </>
    );
  }
}
