import { Component } from '@expressive/mvc';
import { Fragment, host } from '@expressive/mvc/runtime';

declare module '@expressive/mvc/runtime' {
  interface Host {
    node: Three.Node;
  }
}

declare namespace Three {
  /**
   * A placement gated on the `render` contract alone. Requiring `Component`
   * assignability trips contravariance on `props` (the `is` callback narrows
   * per subclass), which rejects every subclass - the same reason core's
   * `JSX.ElementClass` is structural.
   */
  interface Placement {
    render(props?: any): unknown;
  }

  type Node =
    | Element
    | Placement
    | Iterable<Node>
    | boolean
    | null
    | undefined;
}

const ELEMENT = Symbol.for('@expressive/three.element');

interface Element {
  [ELEMENT]: true;
  type: unknown;
  props: Record<string, unknown>;
  key: unknown;
}

function jsx(type: unknown, props: object, key?: unknown): Element {
  return {
    [ELEMENT]: true,
    type,
    props: props as Record<string, unknown>,
    key: key === undefined ? null : key
  };
}

function isElement(node: unknown): node is Element {
  return typeof node == 'object' && node !== null && ELEMENT in node;
}

/**
 * Flatten a render result to the nodes it contributes. Nothing-values drop out;
 * a string would be a scene-graph type error, so it throws rather than coerce.
 */
function childrenOf(children: unknown): Three.Node[] {
  const out: Three.Node[] = [];

  for (const child of [children].flat(Infinity)) {
    if (child == null || typeof child == 'boolean') continue;

    if (isElement(child) || child instanceof Component) {
      out.push(child);
      continue;
    }

    if (typeof child == 'object' && Symbol.iterator in child) {
      out.push(...childrenOf([...(child as Iterable<unknown>)]));
      continue;
    }

    throw new TypeError(
      `A scene graph cannot contain ${JSON.stringify(child)} - ` +
      'only elements, Component instances and collections of them.'
    );
  }

  return out;
}

host({
  jsx,
  jsxs: jsx,
  Fragment,
  isElement,
  childrenOf,
  typeOf: (node) => (isElement(node) ? node.type : undefined),
  propsOf: (node) => (isElement(node) ? node.props : {})
});

export { childrenOf, isElement, jsx, Three };
