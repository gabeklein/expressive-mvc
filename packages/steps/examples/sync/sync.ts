import { get, has, Model, set } from '@expressive/mvc';
import { Steps } from '@expressive/steps';

import { api, type Item } from './services';

export class Feed extends Model {
  items = has<Item>();

  // Feed does not extend Steps, so a plain method - a step calls it inline, outside callers too
  known(id: string) {
    return this.items.any((item) => item.id == id);
  }
}

// Sync already extends Feed, so it cannot extend Steps - it holds a Steps model as a field, owned like any child Model
export class Sync extends Feed {
  token = set<string>();                  // pending until assigned - a step reading it waits
  pull = new Pull();                      // `sync.pull.next()` runs it; `await sync.pull` starts or joins
}

export class Pull extends Steps {
  sync = get(Sync);                       // the owner, found upstream
  cursor = '';
  acked = '';

  async next() {
    this.page();
  }

  protected async page() {
    const { sync } = this;
    const page = await api.page(this.cursor, { token: sync.token, signal: this.then.signal });
    let more = page.next !== undefined;

    // the owner is another Model: a write to it is unmanaged, so an unwind leaves it
    sync.items.push(...page.items.filter((item) => !sync.known(item.id)));
    this.cursor = page.next || this.cursor;

    if (more)
      this.page();                        // a step scheduling itself - loops until the last page
    else
      this.then(async (signal) => {       // an inline step, journaled then#1 and given its own signal
        await api.ack(this.cursor, { signal });
        this.acked = this.cursor;         // an arrow's writes are the inline step's - in then#1's wrote
      });
  }

  // once per run on every outcome - a failed pull starts over
  protected exit(outcome: Steps.Outcome) {
    if (outcome.status != 'done') this.cursor = '';
  }

  // no end(): once the plan drains, the run resolves with a dump of public values
}
