import React from 'react';

import { issues } from '../issues';
import { Model } from '../model';
import { useAmbient, useTap } from './hooks';

export const Oops = issues({
  BadConsumerProps: () =>
    `Provider expects either a render function, 'get' or 'has' props.`
})

interface ConsumerProps {
  of: typeof Model;
  get?: (value: Model) => void;
  has?: (value: Model) => void;
  children?: (value: Model) => React.ReactElement<any, any> | null;
}

export function Consumer(props: ConsumerProps){
  const { get, has, children, of: Control } = props;

  if(typeof children == "function")
    return children(useTap(useAmbient(Control)));

  const callback = has || get;

  if(typeof callback == "function")
    callback(useAmbient(Control, !!has));
  else
    throw Oops.BadConsumerProps()

  return null;
}