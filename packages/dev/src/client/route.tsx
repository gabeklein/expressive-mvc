/** @jsxImportSource @expressive/mvc */

import { set, type Component } from "@expressive/mvc";
import { Route as Base } from "@expressive/router";

type CatchUI = (props: { error: Error; retry: () => void }) => Component.Node;

type EntryHook = (route: Route) => string | void | null | Promise<string | void | null>;

export class Route extends Base {
  fallback: Component.Node = false;

  enter = set<EntryHook | undefined>(undefined, hook => {
    this.redirect = hook ? () => hook(this) : undefined;
  });

  Catch?: CatchUI = undefined;

  NotFound?: (props: { children?: Component.Node }) => Component.Node = undefined;

  protected get children(): Component.Node {
    const children = super.children;
    if (!this.NotFound) return children;

    return (
      <>
        {children}
        <Route none as={this.NotFound} fallback={null} />
      </>
    );
  }
}

Object.defineProperty(Route.prototype, "catch", {
  get(this: Route) {
    const Boundary = this.Catch;

    if (!Boundary) return undefined;

    return (error: Error) => new Promise<void>(retry => {
      this.fallback = <Boundary error={error} retry={retry} />;
    });
  }
});
