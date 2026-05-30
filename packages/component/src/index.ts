// @expressive/component - TRANSITIONAL, en route to @expressive/mvc.
//
// Renderer-agnostic Component contract distilled out of @expressive/react. Holds
// the neutral essence (class skeleton, props reconciliation, lifecycle, types).
// All host *behavior* - mount, suspense + error boundary, and host-family
// features like subcomponents - is filled by adapters: they augment `Host.node`
// and attach behavior to the prototype via a `Component.on` hook.
//
// Guardrail: this package has no `react` dep and no `jsx` in tsconfig. Anything
// that won't compile without React is, by definition, adapter realization.
export { Component } from './component';
export type { Props, StateProps } from './component';
export type { Host, Node } from './host';
