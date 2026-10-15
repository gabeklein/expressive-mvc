import type { Node as RenderNode } from '../node/vnode';
import { door } from '../style/claim';
import type { Appearance, Style } from '../style/claim';
import { appearanceRoot, enterAppearance } from '../style/protocol';
import type { Fiber } from './fiber';
import { latest } from './hot';

let rendering: object | undefined;

let touched = false;

const observed = new WeakMap<object, Record<string, any>>();

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
    const output = render();
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
  const inherited = fiber.appearance?.context || appearanceRoot();
  const context = enterAppearance(inherited, latest(fiber.type as Function));

  if (context?.base && context !== inherited)
    entries.push({ hops: 0, style: context.base as Style });

  if (style && !fiber.consumed && !(fiber.instance && 'style' in fiber.instance)) entries.push({ hops: 0, style });

  return entries.length || context ? { context, entries } : undefined;
}

export { consume, observe, renderedAppearance };
