import { Model, get } from "@expressive/mvc";

import Activity from "../remote";

export default class Counter extends Model {
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

export class Tap extends Model {
  protected activity = get(Activity);
  taps = 0;

  async tap() {
    this.activity.clicks++;
    return ++this.taps;
  }
}
