import { Component, get } from "@expressive/mvc";

import Activity from "../remote";
import Remote, { Tap } from "./remote";

function Tapper(props: { label: string }) {
  const tap = Tap.use();

  return <button onClick={() => tap.tap()}>{props.label} {tap.taps}</button>;
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
