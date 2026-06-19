<h1 align="center">@expressive/router</h1>

<p align="center">
  Class-based declarative router built on Expressive MVC.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@expressive/router"><img alt="NPM" src="https://badge.fury.io/js/%40expressive%2Frouter.svg"></a>
</p>

---

A host-agnostic router for [Expressive MVC](https://github.com/gabeklein/expressive-mvc). Routes are declared as nested JSX, matching is computed lexically from that tree (not a separate config), and navigation state lives on a reactive `Router` any component can read or drive.

```bash
npm install @expressive/router @expressive/react react
```

## Declaring routes

Routes nest to mirror the URL. `to` is the pattern segment, `as` is the page (or layout) component. A layout receives its matched children via `children`.

```tsx
import '@expressive/react';           // registers the host adapter
import { BrowserRouter, Route } from '@expressive/router';

<BrowserRouter>
  <Route as={RootLayout}>
    <Route as={HomePage} />                {/* index - matches the parent path */}
    <Route to="blog" as={BlogLayout}>
      <Route as={BlogIndex} />             {/* /blog */}
      <Route to=":slug" as={BlogPost} />   {/* /blog/:slug */}
    </Route>
    <Route to="login" redirect="/" />      {/* matched -> redirects */}
    <Route default as={NotFound} />        {/* nothing else matched */}
  </Route>
</BrowserRouter>;
```

| Prop | Meaning |
| --- | --- |
| `to` | URL segment. `:name` captures a param, `*` is a catch-all. Omit for an index route. |
| `as` | Component rendered when matched (as a layout, receives `children`). |
| `default` | Matches when no sibling did - scoped to its parent (root = app 404, nested = section 404). |
| `redirect` | When matched, redirect here instead of rendering. |
| `label` / `meta` | Display name / free-form metadata for nav and breadcrumbs (ignored by matching). |

Siblings competing for the same slot arbitrate **first-match by declaration order**. Without an ancestor `Router`, a `<Route>` spins up a headless in-memory one; `BrowserRouter` binds to the address bar.

## Reading the match

A page reads the nearest `Route` from context and uses its reactive getters:

```tsx
import { Consumer } from '@expressive/react';
import { Route } from '@expressive/router';

const BlogPost = () => (
  <Consumer for={Route}>
    {route => <article>post: {route.match!.slug}</article>}
  </Consumer>
);
```

Read `route.matched` (boolean) in render so same-pattern navigations (`/blog/a` → `/blog/b`) reconcile in place instead of remounting.

## Navigation state & the `query` record

`Router` exposes location as reactive surfaces - `path`, a `query` record, and a derived `url`. The query string **is state**: read a key to subscribe, write one to navigate.

```tsx
router.goto('/posts?page=2');   // push
router.goto('/posts', true);    // replace
router.url = '/posts?page=2';   // assigning url navigates

router.query.page;              // read - subscribes to just this param
router.query.page = '2';        // write - pushes a new entry, like goto
delete router.query.sort;       // delete - also navigates
```

Subclass to declare known params for autocomplete and typo-safety:

```tsx
class Search extends Router {
  declare query: { q?: string; page?: string };
}
```

## Links

`Link` renders an `<a>` that navigates on plain left-click (modifier/middle clicks fall through). It exposes its own match state, so active styling needs no separate component:

```tsx
import { Link } from '@expressive/router';

<Link to="blog">Blog</Link>
<Link to="/posts?page=2" replace>Page 2</Link>
```

```tsx
// active links by subclassing - read `active` / `match`
class NavLink extends Link {
  render() {
    return (
      <a href={this.href} onClick={this.go}
         className={this.active ? 'active' : undefined}
         aria-current={this.active ? 'page' : undefined}>
        {this.props.children}
      </a>
    );
  }
}
```

## Redirect

`Redirect` navigates to `to` when mounted, gated on `when` (default `true`), and renders nothing. The `Route` `redirect` prop is an always-replace shorthand for it.

```tsx
import { Redirect } from '@expressive/router';

<Redirect to="/login" when={!user} />     {/* navigates on mount when `when` is true */}
<Redirect to="/home" replace />           {/* overwrite the current entry */}
```

## Generated navigation

`NavLinks` renders a navigation tree from the route hierarchy - it walks the declared routes and emits links automatically. Its rendering is built from PascalCase **subcomponents** you override to shape the output:

| Member | Renders |
| --- | --- |
| `Item` | A single link (defaults to a `Link` using the route's `label`). |
| `List` | The container wrapping a level of items. |
| `Group` | A nested section; transparent by default - override to turn route nesting into headed sections. |

```tsx
import { NavLinks } from '@expressive/router';

class SideNav extends NavLinks {
  List = (props) => <ul className="side">{props.children}</ul>;
  Group = (props) => (
    <section>
      <h3>{props.route.label}</h3>
      {props.children}
    </section>
  );
}
```

These members are overridable reactive subcomponents bound to the live instance - the same model `Component` provides, via [render composition](https://github.com/gabeklein/expressive-mvc/blob/main/packages/react/README.md#render-composition) and [subcomponents](https://github.com/gabeklein/expressive-mvc/blob/main/packages/react/README.md#subcomponents).

---

Routes are plain `@expressive/mvc` Components, so they render under any Expressive host adapter.

Full guide and API reference → **[github.com/gabeklein/expressive-mvc](https://github.com/gabeklein/expressive-mvc)**

## License

MIT
