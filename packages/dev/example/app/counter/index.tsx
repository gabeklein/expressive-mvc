import { Component, get } from "@expressive/mvc";

import Activity from "../remote";
import Remote, { Tap } from "./remote";

class Tapper extends Component {
  label = "";
  tap = new Tap();

  render() {
    const { label, tap } = this;

    return (
      <p>
        <button onClick={() => tap.tap()}>{label} {tap.taps}</button>
        <button onClick={() => tap.log.clear()}>Clear {label}</button>
        <button onClick={() => tap.restart()}>Restart {label}</button>
        <small>{label} since clear: {tap.log.count}</small>
      </p>
    );
  }
}

export class Page extends Component {
  remote = get(Remote);
  activity = get(Activity);

  render() {
    const { remote, activity } = this;

    return (
      <>
        <h1>Counter</h1>
        <button onClick={() => remote.increment()}>Increment</button>
        <button onClick={() => remote.reset()}>Reset</button>
        <output>{remote.count}</output>
        <p>Clicks on this site: <data>{activity.clicks}</data></p>
        <Tapper label="Left" />
        <Tapper label="Right" />
      </>
    );
  }
}
