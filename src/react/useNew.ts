import React from 'react';

import { Model } from '../model';

export function useNew<T extends typeof Model>(
  Type: T, callback?: (instance: InstanceOf<T>) => void) {

  const instance = React.useMemo(() => {
    const instance = Type.create();

    if (callback)
      callback(instance);

    return instance;
  }, []);

  React.useLayoutEffect(() => () => instance.destroy(), []);

  return instance;
}
