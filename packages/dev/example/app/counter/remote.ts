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
