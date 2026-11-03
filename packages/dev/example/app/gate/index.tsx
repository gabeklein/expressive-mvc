import { Route } from "@expressive/dev";

import type Gate from "./remote";

export default (route: Route & { remote: Gate }) => (route.remote.member ? undefined : "/login");

export class Page extends Route {
  declare remote: Gate;

  render() {
    return (
      <>
        <h1>Gate</h1>
        <p>Welcome, {this.remote.name}</p>
      </>
    );
  }
}
