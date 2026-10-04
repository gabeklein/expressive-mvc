/** @jsxImportSource @expressive/mvc */

import type { Component } from "@expressive/mvc";
import { Route as Base } from "@expressive/router";

export class Route extends Base {
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
