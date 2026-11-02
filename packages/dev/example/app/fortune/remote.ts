import { Model, set } from "@expressive/mvc";

export class Fortune extends Model {
  text = set<string>();

  protected new() {
    const timer = setTimeout(() => (this.text = "You will ship it."), 300);
    return () => clearTimeout(timer);
  }
}
