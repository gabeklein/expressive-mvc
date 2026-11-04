import { Model } from "@expressive/mvc";
import { Current, Forbidden } from "@expressive/rpc/http";

export default class Admin extends Model {
  static key() {
    if (Current.get().request.headers.get("authorization") !== "Bearer admin") throw new Forbidden("Admins only.");

    return undefined;
  }
}
