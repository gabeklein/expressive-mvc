/** @jsxImportSource @expressive/mvc */

import { set, type Component } from "@expressive/mvc";
import { Route as Base } from "@expressive/router";

type EntryHook = (route: Route) => string | void | null | Promise<string | void | null>;

export class Route extends Base {
  enter = set<EntryHook | undefined>(undefined, hook => {
    this.redirect = hook ? () => hook(this) : undefined;
  });

  Catch?: (props: { error: Error; retry: () => void }) => Component.Node = undefined;

  NotFound?: (props: { children?: Component.Node }) => Component.Node = undefined;

  protected get children(): Component.Node {
    const children = super.children;
    if (!this.NotFound) return children;

    return (
      <>
        {children}
        <Route none as={this.NotFound} />
      </>
    );
  }

  async catch(error: Error) {
    const Boundary = this.Catch;
    if (!Boundary) throw error;

    await new Promise<void>((retry) => {
      this.fallback = <Boundary error={error} retry={retry} />;
    });
  }
}
