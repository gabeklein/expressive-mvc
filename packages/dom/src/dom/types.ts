import type { Node } from '../node/vnode';

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

export type { Intrinsics, Style };
