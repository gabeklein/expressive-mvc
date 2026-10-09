import { State } from "@expressive/mvc";

import { add, fail, reset } from "./api";

class Tally extends State {
  shown = "";

  async run(task: () => Promise<unknown>) {
    try {
      this.shown = String(await task());
    } catch (error) {
      this.shown = (error as Error).message;
    }
  }
}

export function Page() {
  const { shown, run } = Tally.use();

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
