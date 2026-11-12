import { BrowserRouter } from "@expressive/router";

/** The app's `BrowserRouter` - `Router.get().navigating` is true while a navigation holds the current page. */
export class Router extends BrowserRouter {
  protected next(url: string, replace?: boolean) {
    if (typeof window == "undefined") return Promise.resolve(this.locate(url));

    return super.next(url, replace);
  }
}
