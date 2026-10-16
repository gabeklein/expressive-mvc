import { State, set } from "@expressive/mvc";

export class Fortune extends State {
  text = set<string>();

  protected new() {
    const timer = setTimeout(() => (this.text = "You will ship it."), 300);
    return () => clearTimeout(timer);
  }
}
