import { State } from "@expressive/mvc";

export default class Counter extends State {
  count = 0;

  async increment() {
    return ++this.count;
  }

  async reset() {
    this.count = 0;
  }
}
