---
"@expressive/router": minor
---

Widen `Route`'s `as` to accept any function or class element type, including a fellow `Route` subclass, instead of only a `(props) => Node` function. The type is mvc's agnostic `Exclude<JSX.ElementType, string>`, so a `Route`/component class type-checks as `as` while intrinsic host tags stay excluded. This enables `<Route as={SomeRouteClass} />` - e.g. a generated wrapper delegating to a user page class - without a cast. When `as` is itself a `Route`, delegation falls out of the existing see-through machinery: the inner Route is the sole arbiter, receives the outer's computed `nested` as its children, and `Route.get` inside its content resolves the inner instance.
