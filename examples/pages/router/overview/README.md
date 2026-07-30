# Router

Routes are Components - a route matches a path and the Component it names
renders, with no separate page abstraction. `Layout` draws the nav once and
receives the matched child as `props.children`, so nesting routes nests
components.

A page reads its own route with `get(Route)`, which is where params, match
state and navigation come from - `User` reads `this.route.match?.name` without
being handed a prop. Routes are ordinary classes, so loading and guards live on
the route itself.
