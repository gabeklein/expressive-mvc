import { Fragment, host } from '@expressive/mvc/runtime';

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

type EventAttributes = {
  [K in keyof GlobalEventHandlersEventMap as `on${EventName<K>}`]?:
    (event: GlobalEventHandlersEventMap[K]) => unknown;
} & {
  [K in keyof GlobalEventHandlersEventMap as `on${EventName<K>}Capture`]?:
    (event: GlobalEventHandlersEventMap[K]) => unknown;
};

type Style = Partial<Record<keyof CSSStyleDeclaration, string | number | null>>;

type Attributes<T extends Element> = EventAttributes & {
  [K in keyof T as K extends 'children' | 'className' | 'style'
    ? never
    : T[K] extends Function
      ? never
      : K]?: T[K] | string | number | boolean;
} & {
  children?: Node;
  class?: string;
  className?: string;
  dangerouslySetInnerHTML?: { __html: string };
  key?: string | number | null;
  ref?: ((node: T | null) => unknown) | { current: T | null };
  style?: string | Style;
  [attribute: `data-${string}`]: unknown;
  [attribute: `aria-${string}`]: unknown;
};

type Intrinsics = {
  [K in keyof HTMLElementTagNameMap]: Attributes<HTMLElementTagNameMap[K]>;
} & {
  [K in keyof SVGElementTagNameMap]: Attributes<SVGElementTagNameMap[K]>;
};

declare module '@expressive/mvc/runtime' {
  interface Host {
    node: Node;
    intrinsics: Intrinsics;
  }
}

const runtime = {
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
};

host(runtime);

const jsx = vnode;
const jsxs = vnode;

export { Fragment, jsx, jsxs };
export type { VNode as JSXElement };
export type { JSX } from '@expressive/mvc/jsx-runtime';
