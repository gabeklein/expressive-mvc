import { Context, has, map } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';

import type { Appearance } from '../style/claim';
import { makeScope, range } from './fiber';
import type { Boundary, Fiber } from './fiber';
import { complete } from './mount';
import { attempt, passiveRender } from './render';
import { schedule, transition } from './scheduler';
import type { HostNode } from './host';

function mountCollection(value: has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown>, parent: HostNode, before: HostNode | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const fiber = range('collection', parent, before, context);
  fiber.source = value;
  fiber.value = value;
  fiber.boundary = boundary;
  fiber.appearance = appearance;
  fiber.scope = makeScope('collection', context, (passive) => runCollection(fiber, passive));

  let first = true;
  fiber.release = watch(value, (current) => {
    fiber.value = current;
    if (!first && fiber.scope?.active) schedule(fiber.scope);
    first = false;
  }, undefined, transition);

  return complete(fiber, () => {
    runCollection(fiber, passiveRender);
  });
}

function runCollection(fiber: Fiber, passive: boolean) {
  attempt(fiber, passive, () => {
    const value = fiber.value as Iterable<unknown>;
    return value instanceof map.Managed ? [...value.values()] : [...value];
  });
}

function patchCollection(fiber: Fiber, appearance?: Appearance) {
  if (fiber.appearance === appearance) return;

  fiber.appearance = appearance;
  runCollection(fiber, passiveRender);
}

function isCollection(value: unknown): value is has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown> {
  return value instanceof has.List || value instanceof has.Pool || value instanceof map.Managed;
}

export { isCollection, mountCollection, patchCollection };
