/** @jsxImportSource @expressive/mvc */

import { def, Model, set, type Component } from "@expressive/mvc";
import { Route as Base } from "@expressive/router";

type CatchUI = (props: { error: Error; retry: () => void }) => Component.Node;

type Verdict = string | void | null;

type EntryHook = (route: Route) => Verdict | Promise<Verdict>;

const SEATS = new WeakMap<Route, Model.Type>();
const HOOKS = new WeakMap<Route, EntryHook | undefined>();

/**
 * Router's `Route` with a route module's exports - the generated tree builds one per module.
 *
 * Extend it for a class `Page`; the tree sets `enter`, `remote`, `Catch`, `NotFound` and `fallback`.
 */
export class Route extends Base {
  /** Shown while this route or a page below suspends on a cold load - the folder's `Loading`. Default none. */
  fallback: Component.Node = false;

  /**
   * Entry hook - a function `default` export, run with the Route before render.
   *
   * A returned string redirects and `null` falls through to the 404. It may be async.
   * Under a seat it runs after the seat's first pull, with `route.remote` set.
   * A thrown error with a 3xx `status` and a `location` redirects there; any other reaches `Catch`.
   */
  enter = set<EntryHook | undefined>(undefined, hook => {
    HOOKS.set(this, hook);
    if (!SEATS.has(this)) arm(this);
  });

  /**
   * The folder's seat - its server Model's twin - inherited from the nearest seated ancestor.
   *
   * Assigning a Model class seats the route: each entry builds a fresh instance and waits for its first pull.
   * Leaving the route clears it.
   */
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

  /** Error UI for this route - `retry` re-renders the content. */
  Catch?: CatchUI = undefined;

  /** Rendered for a path under this route that no child matches. */
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
    route.redirect = hook && (() => {
      try {
        const verdict = hook(route);

        return verdict instanceof Promise ? verdict.catch(redirected) : verdict;
      } catch (error) {
        return redirected(error);
      }
    });
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

  if (typeof status == "number" && status >= 300 && status < 400 && typeof location == "string" && location) return location;

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
