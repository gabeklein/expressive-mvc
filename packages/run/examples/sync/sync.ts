import { has, State } from '@expressive/mvc';
import { run } from '@expressive/run';

import { api, type Item } from './services';

export class Feed extends State {
  items = has<Item>();
  cursor = '';
}

// Sync already extends Feed, so it cannot extend Job - run(this) is the same runtime as a field
export class Sync extends Feed {
  then = run(this);

  async next() {
    this.pull();
  }

  protected async pull() {
    const page = await api.page(this.cursor, { signal: this.then.signal });
    let more = page.next !== undefined;

    this.items.push(...page.items);
    this.cursor = page.next || this.cursor;

    if (more)
      this.pull();                        // a step scheduling itself - loops until the last page
    else
      this.then(async (signal) => {       // an inline step, journaled then#1 and given its own signal
        await api.ack(this.cursor, { signal });
      });
  }

  // no end(): once the plan drains, the run resolves with a dump of public values
}
