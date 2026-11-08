import { Component } from "@expressive/mvc";

import { Fortune } from "./remote";

class Reading extends Component {
  fortune = new Fortune();

  render() {
    return <p>{this.fortune.text}</p>;
  }
}

export function Page() {
  return (
    <>
      <h1>Fortune</h1>
      <Reading />
    </>
  );
}
