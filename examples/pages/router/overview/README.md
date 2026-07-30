# Router

Routes are Components. A route matches a path and the Component it names
renders - there is no separate page abstraction.

## What to try

Follow the links. Navigation is in-memory here, so nothing leaves the sandbox,
and the **User** link shows a param arriving from the path.

## What it teaches

**A layout is a Component that renders its children.** `Layout` draws the nav
once and puts the matched child in `props.children`. Nesting routes nests
components; nothing else declares the hierarchy.

**A page reads its own route.** `get(Route)` gives a Component the route it was
matched by, which is where params, match state and navigation come from - so
`User` reads `this.route.match?.name` without being handed a prop.

**Routes are ordinary classes.** They have fields, methods and lifecycle like
any other Component, so data loading and guards live on the route itself.

## Where to look next

- **get** covers context lookup generally, of which `get(Route)` is one case.
- **lifecycle** is where a route would fetch on mount.
