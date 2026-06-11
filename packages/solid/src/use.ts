import { State, event, observer } from '@expressive/mvc';

import { signalProxy } from './state';

/**
 * Subscribe to an existing State (or observable) instance.
 *
 * Does not own the lifecycle of given subject - it will not be destroyed
 * on cleanup. If subject is not yet active, it will be activated.
 *
 * @param subject Instance of State (or observable) to subscribe to.
 * @returns Reactive proxy with signal accessors for all non-function values.
 */
export function use<T extends State>(subject: T): State.Reactive<T> {
  const status = observer(subject);

  if (status === null)
    throw new Error('Provided object is no longer observable.');

  if (!status) throw new Error('Provided object is not observable.');

  if (!status.ready) event(subject);

  return signalProxy(subject);
}
