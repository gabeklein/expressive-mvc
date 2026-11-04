/** @jsxImportSource @expressive/mvc */

import { def, Model, set, type Component } from "@expressive/mvc";
import { Route as Base } from "@expressive/router";

type CatchUI = (props: { error: Error; retry: () => void }) => Component.Node;

type Verdict = string | void | null;

type EntryHook = (route: Route) => Verdict | Promise<Verdict>;

const SEATS = new WeakMap<Route, Model.Type>();
const HOOKS = new WeakMap<Route, EntryHook | undefined>();

export class Route extends Base {
  fallback: Component.Node = false;

  enter = set<EntryHook | undefined>(undefined, hook => {
    HOOKS.set(this, hook);
    if (!SEATS.has(this)) arm(this);
  });

  remote?: Model = def<Model | undefined>((_key, route: Route) => {
    const config: Model.Apply = {
      get: self => ((self as Route).parent as Route | undefined)?.remote,
      set(next) {
        if (!Model.is(next)) return;

        if (SEATS.get(route) !== next) {
          config.get = false;
          SEATS.set(route, next as Model.Type);
          arm(route);
          route.get(({ matched }) => {
            if (!matched) route.remote = undefined;
          });
        }

        throw false;
      },
    };

    return config;
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

function arm(route: Route): void {
  const Seat = SEATS.get(route);
  const hook = HOOKS.get(route);

  if (!Seat) {
    route.redirect = hook ? () => hook(route) : undefined;
    return;
  }

  route.redirect = async () => {
    const at = space(route);
    const seat = new Seat();
    const stale = () => route.remote !== seat || space(route) !== at;

    route.remote = seat;

    try {
      await seat.get(() => {});

      return stale() ? undefined : await HOOKS.get(route)?.(route);
    } catch (error) {
      return stale() ? undefined : redirected(error);
    }
  };
}

function space(route: Route): string {
  const depth = split(route.base + route.router.segment(route.to)).length;

  return split(route.router.path).slice(0, depth).join("/");
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function redirected(error: unknown): string {
  const { status, location } = Object(error) as { status?: unknown; location?: unknown };

  if (typeof status == "number" && status >= 300 && status < 400 && typeof location == "string") return location;

  throw error;
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
