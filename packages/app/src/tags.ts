import {
  AbsoluteLayout,
  ActivityIndicator,
  Button,
  ContentView,
  DockLayout,
  FlexboxLayout,
  GridLayout,
  Image,
  Label,
  ScrollView,
  StackLayout,
  Switch,
  TextField,
  TextView,
  View,
  WrapLayout
} from '@nativescript/core';
import type { EventData } from '@nativescript/core';
import type { Node } from '@expressive/jsx/node/vnode';
import type { Style } from '@expressive/jsx/jsx-runtime';

const TAGS = {
  absoluteLayout: AbsoluteLayout,
  activityIndicator: ActivityIndicator,
  button: Button,
  contentView: ContentView,
  dockLayout: DockLayout,
  flexboxLayout: FlexboxLayout,
  gridLayout: GridLayout,
  image: Image,
  label: Label,
  scrollView: ScrollView,
  stackLayout: StackLayout,
  switch: Switch,
  textField: TextField,
  textView: TextView,
  wrapLayout: WrapLayout
};

type Tag = keyof typeof TAGS;

function create(tag: string): View {
  const Type = TAGS[tag as Tag];

  if (!Type) throw new Error(`Unknown native tag <${tag}>.`);
  return new Type();
}

type Settable<T> = {
  [K in keyof T as K extends 'style' | 'className' | `_${string}` ? never : T[K] extends Function ? never : K]?: T[K] | string | number | boolean;
};

type Attributes<T extends View> = Settable<T> & {
  children?: Node;
  className?: string;
  key?: string | number | null;
  ref?: ((view: T | null) => unknown) | { current: T | null };
  style?: Style;
  [event: `on${Capitalize<string>}`]: ((data: EventData & { object: T }) => unknown) | undefined;
  [rule: `_${string}`]: unknown;
};

type Tags = { [K in Tag]: Attributes<InstanceType<(typeof TAGS)[K]>> };

declare module '@expressive/jsx/jsx-runtime' {
  interface Tags extends NativeTags {}
}

type NativeTags = Tags;

export { create, TAGS };
export type { Tag };
