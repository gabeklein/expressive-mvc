import { authoring, authorOf } from '../node/vnode';
import type { Node as RenderNode } from '../node/vnode';
import { door } from '../style/claim';
import type { Appearance, Style } from '../style/claim';
import { enterAppearance } from '../style/protocol';
import { owner } from './adapter';
import type { Fiber } from './fiber';
import { latest } from './hot';

let rendering: object | undefined;

let touched = false;

const observed = new WeakMap<object, Record<string, any>>();
const bare = new WeakMap<Fiber, Appearance>();

function observe(props: Record<string, any>) {
  if (!('style' in props)) return props;

  let output = observed.get(props);

  if (!output) {
    const { style } = props;
    let handle: Style;
    let resolved = false;

    output = Object.defineProperty({ ...props }, 'style', {
      enumerable: true,
      get() {
        if (rendering === output) touched = true;
        if (!resolved) {
          handle = door(style);
          resolved = true;
        }
        return handle;
      }
    });
    observed.set(props, output);
  }

  return output;
}

function consume(fiber: Fiber, render: () => RenderNode) {
  const previous = rendering;
  const read = touched;

  rendering = fiber.props;
  touched = false;

  try {
    const output = authoring(fiber, render);
    fiber.consumed = touched;
    return output;
  } finally {
    rendering = previous;
    touched = read;
  }
}

function renderedAppearance(fiber: Fiber): Appearance | undefined {
  if (fiber.kind != 'component' && fiber.kind != 'function') return fiber.appearance;

  const style = fiber.props?.style as Style;
  const entries = (fiber.appearance?.entries || []).map(({ hops, style }) => ({ hops: hops + 1, style }));
  const sub = owner(fiber.type);
  const context = sub
    ? enterAppearance(latest(sub.owner.constructor), sub.key)
    : enterAppearance(latest(fiber.type as Function));

  if (context?.base)
    entries.push({ hops: 0, style: context.base as Style });

  if (style && !fiber.consumed && !(fiber.instance && 'style' in fiber.instance)) entries.push({ hops: 0, style });

  if (entries.length || context) return { author: fiber, context, entries };

  let empty = bare.get(fiber);
  if (!empty) bare.set(fiber, (empty = { author: fiber, entries }));
  return empty;
}

function authored(value: RenderNode, appearance: Appearance | undefined): Appearance | undefined {
  const author = authorOf(value);

  if (!author || !appearance || author === appearance.author) return appearance;

  for (let fiber = appearance.author as Fiber | undefined; fiber; fiber = fiber.appearance?.author as Fiber | undefined)
    if (fiber.appearance?.author === author)
      return { author, context: fiber.appearance.lexical, entries: appearance.entries };

  return appearance;
}

export { authored, consume, observe, renderedAppearance };
