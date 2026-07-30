# Counter

The smallest complete component: one class that is both the state and the
view. `current` is a reactive field, so `this.current++` *is* the update - the
view re-renders because `render()` read it, and nothing declares a dependency.

Methods are declared, not arrow properties. Binding is intrinsic to the class,
which is why `render()` can destructure `increment` off `this` and hand it
straight to `onClick`. Click the number itself to reset.
