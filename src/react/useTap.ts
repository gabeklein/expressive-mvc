import { Stateful } from '../model';
import { useFrom } from './useFrom';
import { useModel } from './useModel';

export function useTap(
  model: (() => Stateful) | Stateful,
  path?: string | Function,
  expect?: boolean) {

  return typeof path == "function"
    ? useFrom(model, path, expect)
    : useModel(model, path, expect);
}
