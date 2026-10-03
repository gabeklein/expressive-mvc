import { Fragment, host } from '@expressive/mvc/jsx-runtime';
import type { Component, State } from '@expressive/mvc';
import type { JSX as Base } from '@expressive/mvc/jsx-runtime';

import { childrenOf, isVNode, vnode } from './vnode';
import type { Node, VNode } from './vnode';

type Words =
  | 'AnimationCancel' | 'AnimationEnd' | 'AnimationIteration' | 'AnimationStart'
  | 'AuxClick' | 'BeforeInput' | 'BeforeMatch' | 'BeforeToggle' | 'CanPlay' | 'CanPlayThrough'
  | 'CompositionEnd' | 'CompositionStart' | 'CompositionUpdate'
  | 'ContextLost' | 'ContextMenu' | 'ContextRestored' | 'CueChange' | 'DblClick'
  | 'DragEnd' | 'DragEnter' | 'DragLeave' | 'DragOver' | 'DragStart' | 'DurationChange'
  | 'FocusIn' | 'FocusOut' | 'FormData' | 'GotPointerCapture' | 'KeyDown' | 'KeyPress' | 'KeyUp'
  | 'LoadedData' | 'LoadedMetadata' | 'LoadStart' | 'LostPointerCapture'
  | 'MouseDown' | 'MouseEnter' | 'MouseLeave' | 'MouseMove' | 'MouseOut' | 'MouseOver' | 'MouseUp'
  | 'PointerCancel' | 'PointerDown' | 'PointerEnter' | 'PointerLeave' | 'PointerMove'
  | 'PointerOut' | 'PointerOver' | 'PointerRawUpdate' | 'PointerUp'
  | 'RateChange' | 'ScrollEnd' | 'SecurityPolicyViolation' | 'SelectionChange' | 'SelectStart'
  | 'SlotChange' | 'TimeUpdate' | 'TouchCancel' | 'TouchEnd' | 'TouchMove' | 'TouchStart'
  | 'TransitionCancel' | 'TransitionEnd' | 'TransitionRun' | 'TransitionStart' | 'VolumeChange';

type Cased = { [W in Words as Lowercase<W>]: W };
type EventName<K> = K extends keyof Cased ? Cased[K] : Capitalize<K & string>;

type EventAttributes<T extends Element> = {
  [K in keyof GlobalEventHandlersEventMap as `on${EventName<K>}`]?:
    (event: GlobalEventHandlersEventMap[K] & { currentTarget: T }) => unknown;
} & {
  [K in keyof GlobalEventHandlersEventMap as `on${EventName<K>}Capture`]?:
    (event: GlobalEventHandlersEventMap[K] & { currentTarget: T }) => unknown;
};

type Declarations = Partial<Record<keyof CSSStyleDeclaration, string | number | null>> & {
  [property: `--${string}`]: string | number | null | undefined;
};
type Style = string | Declarations | false | null | undefined | readonly Style[];

type SVGAttributes = {
  [K in
    | 'clipPathUnits' | 'cx' | 'cy' | 'd' | 'dx' | 'dy' | 'fill' | 'filter' | 'fx' | 'fy'
    | 'gradientTransform' | 'gradientUnits' | 'height' | 'href' | 'in' | 'in2' | 'mask'
    | 'markerHeight' | 'markerUnits' | 'markerWidth' | 'maskUnits' | 'offset' | 'opacity'
    | 'orient' | 'pathLength' | 'patternUnits' | 'points' | 'preserveAspectRatio' | 'r'
    | 'refX' | 'refY' | 'result' | 'rotate' | 'rx' | 'ry' | 'stdDeviation' | 'stroke'
    | 'textLength' | 'transform' | 'type' | 'values' | 'version' | 'viewBox' | 'width'
    | 'x' | 'x1' | 'x2' | 'xmlns' | 'y' | 'y1' | 'y2']?: string | number;
};

type Attributes<T extends Element> = EventAttributes<T> & {
  [K in keyof T as K extends 'children' | 'className' | 'style'
    ? never
    : T[K] extends Function
      ? never
      : K]?: T[K] | string | number | boolean;
} & {
  children?: Node;
  className?: string;
  autoFocus?: boolean;
  onDoubleClick?: (event: MouseEvent & { currentTarget: T }) => unknown;
  dangerouslySetInnerHTML?: { __html: string };
  key?: string | number | null;
  ref?: ((node: T | null) => unknown) | { current: T | null };
  style?: Style;
  [attribute: `_${string}`]: unknown;
  [attribute: `data-${string}`]: unknown;
  [attribute: `aria-${string}`]: unknown;
};

type Intrinsics = {
  [K in keyof HTMLElementTagNameMap]: Attributes<HTMLElementTagNameMap[K]>;
} & {
  [K in keyof SVGElementTagNameMap]: Attributes<SVGElementTagNameMap[K]> & SVGAttributes;
};

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: Node;
    intrinsics: Intrinsics;
  }
}

declare module '@expressive/mvc' {
  namespace State {
    /** JSX attributes of a State with no `props` member: its settable fields, `is`, a boundary, and what `render` accepts. */
    type Props<T extends State> =
      & Component.StateProps<T>
      & {
        is?: (instance: T) => void;
        /** Shown while this element's content is suspended or recovering. `false` opts out. */
        fallback?: Reserved<T, 'fallback', Component.Node | false>;
        /** Called when this element's content throws. A returned promise retries once settled. */
        catch?: Reserved<T, 'catch', (error: Error, instance: T) => Promise<void> | void>;
      }
      & Component.RenderProps<T extends { render: infer R } ? R : never>;

    /** Boundary attribute type, narrowed by a member of the same name so a mismatch fails at the element. */
    type Reserved<T, K extends string, V> = K extends keyof T ? T[K] & V : V;
  }
}

declare module '@expressive/mvc/jsx-runtime' {
  namespace JSX {
    interface IntrinsicAttributes {
      style?: Style;
      [attribute: `_${string}`]: unknown;
    }
  }
}

host({
  jsx: vnode,
  jsxs: vnode,
  Fragment,
  childrenOf,
  isElement: isVNode,
  typeOf(node: unknown) {
    return isVNode(node) ? node.type : undefined;
  },
  propsOf(node: unknown) {
    return isVNode(node) ? node.props : {};
  }
});

const jsx = vnode;
const jsxs = vnode;

export { Fragment, jsx, jsxs };
export type { VNode as JSXElement };
export declare namespace JSX {
  type Element = Base.Element;
  type ElementType =
    | keyof IntrinsicElements
    | ((props: any) => Component.Node)
    | (abstract new (...args: any[]) => ElementClass);
  /**
   * Any State renders as a class element - one with `render` produces content,
   * one without passes children through and provides itself.
   */
  interface ElementClass extends State { render?(props?: any): Component.Node }
  /**
   * Empty, so a class element's attributes resolve from its instance type and
   * {@link LibraryManagedAttributes} picks `props` when declared, else derives
   * them from the State.
   */
  interface ElementAttributesProperty {}
  type LibraryManagedAttributes<C, P> =
    C extends abstract new (...args: any[]) => infer I
      ? P extends { props: infer Q } ? Q
      : I extends State ? State.Props<I>
      : P
      : P;
  interface ElementChildrenAttribute extends Base.ElementChildrenAttribute {}
  interface IntrinsicAttributes extends Base.IntrinsicAttributes {}
  type IntrinsicElements = Base.IntrinsicElements;
}
