import { State, get } from "@expressive/mvc";

import Activity from "../remote";

export default class Counter extends State {
  protected activity = get(Activity);
  count = 0;

  async increment() {
    this.activity.clicks++;
    return ++this.count;
  }

  async reset() {
    this.count = 0;
  }
}

class Log extends State {
  count = 0;

  async clear() {
    this.count = 0;
  }
}

export class Tap extends State {
  protected activity = get(Activity);
  taps = 0;
  log = new Log();

  async tap() {
    this.activity.clicks++;
    this.log.count++;
    return ++this.taps;
  }

  async restart() {
    this.taps = 0;
    this.log = new Log();
  }
}
