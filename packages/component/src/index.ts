// @expressive/component - TRANSITIONAL, en route to @expressive/mvc.
//
// Renderer-agnostic Component contract being distilled out of @expressive/react.
// Holds the neutral essence (class skeleton, props reconciliation, subcomponent
// discovery, types). All host *behavior* - mount, subcomponent realization,
// suspense + error boundary - stays in adapters and attaches to this skeleton.
//
// Guardrail: this package has no `react` dep and no `jsx` in tsconfig. Anything
// that won't compile without React is, by definition, adapter realization.
//
// Pending seam decision (Bucket C) before the Component class moves here:
//   2. mount seam (host activation of a component)
//   3. subcomponent realize seam
export type { Host, Node } from './host';
