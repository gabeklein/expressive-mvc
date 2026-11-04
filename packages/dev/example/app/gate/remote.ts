import { Model } from "@expressive/mvc";
import { Current } from "@expressive/dev/server";

export class Banned extends Error {
  status = 403;
}

export class SignIn extends Error {
  status = 302;
  location = "/login";
}

export default class Gate extends Model {
  name = "";
  member = false;

  protected static key() {
    const { gate } = Current.get().cookies;

    if (!gate) throw new SignIn("Sign in to pass the gate.");
    if (gate == "banned") throw new Banned("Banned from the gate.");

    return gate;
  }

  protected async new() {
    const { gate } = Current.get().cookies;

    await new Promise(resolve => setTimeout(resolve, 100));

    this.name = gate;
    this.member = gate != "guest";
  }
}
