import { Model } from "@expressive/mvc";
import { Current, Unauthorized } from "@expressive/rpc/http";

export default class Session extends Model {
  static key() {
    const token = Current.get().request.headers.get("authorization");

    if (!token) throw new Unauthorized("Sign in first.");

    return token;
  }
}
