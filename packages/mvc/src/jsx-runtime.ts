import type { Component } from './component';
import type { Host } from './runtime';

/**
 * Transform-contract module: exactly what `jsxImportSource` resolves here -
 * element creation and the `JSX` namespace. Everything else about the host
 * (registration, introspection, scheduling) lives in `@expressive/mvc/runtime`.
 */
export { Fragment, jsx, jsxs } from './runtime';

export declare namespace JSX {
  type Element = Component.Node;
  type ElementType =
    | keyof IntrinsicElements
    | ((props: any) => Component.Node)
    | (abstract new (...args: any[]) => ElementClass);
  /**
   * Gates class element types on the `render` contract alone - requiring full
   * `Component` assignability trips contravariance on `props` members (e.g.
   * the `is` callback narrows per subclass), rejecting every subclass.
   */
  interface ElementClass { render(props?: any): Component.Node }
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: string | number | null }
  /**
   * Host tag manifest, via the {@link Host} seam. Resolves to `{}` until an
   * adapter augments `Host` with `intrinsics` - agnostic code is
   * components-only by design, since it cannot know what tags a host renders.
   */
  type IntrinsicElements =
    Host extends { intrinsics: infer T extends object } ? T : {};
}
