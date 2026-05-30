// @expressive/component - TRANSITIONAL, en route to @expressive/mvc.
//
// Renderer-agnostic Component contract distilled out of @expressive/react. Holds
// the neutral essence (class skeleton, props reconciliation, subcomponent
// discovery, types). All host *behavior* - mount, subcomponent realization,
// suspense + error boundary - is filled by adapters: they augment `Host.node`,
// attach React-specific behavior to the prototype, and wire realization by
// calling `discover` from a `Component.on` hook.
//
// Guardrail: this package has no `react` dep and no `jsx` in tsconfig. Anything
// that won't compile without React is, by definition, adapter realization.
export { Component, discover } from './component';
export type { Props, StateProps, Realize } from './component';
export type { Host, Node } from './host';
