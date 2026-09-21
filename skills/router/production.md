# Router production guide

Use this with [router.md](router.md). The router owns matching, location,
history, guards, and presentation settlement. Domain `State` owns data,
mutations, caching, retry, and request cancellation.

## Choose the router

| Need                                          | Use                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Browser address + History API                 | `<BrowserRouter>`                                                                                      |
| Unit/integration test without browser history | `Router.new({ path })` + `<Provider>`                                                                  |
| React Native or another non-browser host      | `Router`; render host navigation controls                                                              |
| Existing framework router                     | Keep it and bridge route values into MVC; do not add `@expressive/router` during an unrelated refactor |
| Framework SSR/data routing                    | The framework router                                                                                   |

A parent-less `Route` creates a private headless Router, useful for small tests.
Provide the router explicitly when its starting path or lifetime matters.

```tsx
const router = Router.new({ path: '/projects/42' });

render(
  <Provider for={router}>
    <AppRoutes />
  </Provider>
);

router.set(null);
```

## Page data belongs to State

There are no router loaders, actions, fetchers, cache, or revalidation APIs. A
page `Component` or owned domain `State` reads the nearest Route; a reactive
async field suspends through the Route boundary:

```tsx
class ProjectPage extends Component {
  route = get(Route);

  project = set(async (self) => {
    const id = self.route.match!.id;
    const response = await fetch(`/api/projects/${id}`);
    if (!response.ok) throw new Error('Project unavailable');
    return response.json() as Promise<Project>;
  });

  render() {
    return <ProjectView project={this.project} />;
  }
}

<Route to="projects/:id" fallback={<Spinner />} as={ProjectPage} />;
```

The declared `self` parameter makes the `set` factory reactive: a same-pattern
param change recomputes from the new `match`. A zero-argument factory would run
once.

Navigation latest-wins guards router state and history, not application
requests. Abort or generation-check expensive and side-effecting work in its
owning State. Do not add an async router effect merely to relocate domain work.

Use an entry guard for entry policy or redirect/not-found arbitration, not as a
general loader:

- string: redirect with replacement;
- `undefined`, `false`, or `''`: allow;
- `null`: cede to the nearest scoped `default`.

## Presentation settlement

Every navigation (`goto`, `Link`, query mutation, memory history, popstate, or
external History API call) runs through protected `Router.navigate(work)`.
React's adapter applies the default non-urgently.

- Cold load: the matched Route's `fallback` renders while it suspends.
- In-app navigation: the outgoing screen holds until the next screen is ready.
- Overlap: only the latest navigation may apply work, commit history, or clear
  `navigating`.
- Destruction: delayed work does not commit after the router is destroyed.

`router.navigating` spans the call through presentation. Read it in a sibling or
wrapper around routed content. A component which both reads it urgently and
rebuilds the deferred route content can forfeit the hold.

```tsx
function Status() {
  const { navigating } = BrowserRouter.get();
  return <progress aria-label="Loading page" hidden={!navigating} />;
}
```

For `goto`, `Link`, and query mutations, BrowserRouter writes the address after
the screen settles. Back/Forward and external History calls change the address
before the router receives them.

Override `navigate(work)` only for a presentation mechanism that can run and
settle the supplied work. Status and latest-wins ordering wrap the override; it
need not call `super`.

## Errors and not-found

- A lazy page or async field throwing a Promise suspends into `fallback`.
- A rejected lazy import or async field is an error. Handle it with
  `Component.catch` on a Route subclass or an ancestor boundary.
- A structural miss reaches the nearest `default` Route.
- A guard returning `null` force-404s into that same scoped default.

Put a resource leaf inside a parent Route with a `default` when it needs a
section-specific not-found page.

## Test the owner of the behavior

Use a headless Router for matching, relative navigation, params, query state,
guards, defaults, and memory history. Use BrowserRouter only when the assertion
depends on `window.location`, `window.history`, Back/Forward, external History
calls, or address timing.

For suspended navigation, assert all three stages:

1. after navigation begins: outgoing screen remains and `navigating` is true;
2. while pending: the target has not committed to page/history;
3. after resolution: target screen and history agree and `navigating` is false.

Add a reverse-settlement case when work can overlap: start A, start B, resolve B,
then A; A must not change state, history, or status.

`goto()` returns `void`. Observe rendered output and `navigating`; do not await
the method as a completion signal.

## Host and URL boundary

Supported location state is pathname, a single string value per query key, and
an opaque fragment string. Repeated query keys collapse to the last value. URL
changes reconcile the same reactive Map instance. Fragment state remains
percent-encoded and does not trigger automatic scrolling or focus.

Not currently supported by the public contract:

- automatic scroll-to-anchor;
- basename/subpath mounting;
- arbitrary `history.state` and `go(n)`;
- scroll restoration or automatic scroll-to-top;
- navigation blocking;
- external URL routing;
- typed/structured query schemas;
- router-owned loading, mutation, prefetch, cache, or revalidation;
- request-path SSR, redirects, loader serialization, or hydration.

External URL routing remains outside the router. `Link` preserves
scheme-bearing and protocol-relative targets as browser-owned anchors; it does
not route them through the SPA.

Do not simulate the other limits by relying on current normalization accidents.
Use the host/framework router until the relevant feature lands.

Server rendering does not register Router/BrowserRouter as a shared process
global, so requests do not leak the default instance. This is crash and
isolation safety, not an SSR routing system.

On React Native use Router directly. BrowserRouter requires browser globals;
Link and NavLinks render DOM elements, so native controls call `goto` instead.

## Accessibility ownership

Link emits a real anchor and preserves modifier/middle clicks. Active-link
subclasses should set `aria-current="page"`. Applications own document title,
focus placement, announcements, and scroll behavior after navigation; the
router does not currently automate them.
