import * as Computed from '../compute';
import { control, Controller } from '../controller';
import { issues } from '../issues';
import { Stateful } from '../model';
import { pendingValue } from '../suspense';
import { apply } from './apply';

export const Oops = issues({
  BadComputedSource: (model, property, got) =>
    `Bad from-instruction provided to ${model}.${property}. Expects an arrow-function or a Model as source. Got ${got}.`,

  PeerNotAllowed: (model, property) =>
    `Attempted to use an instruction result (probably use or tap) as computed source for ${model}.${property}. This is not possible.`
})

type ComputeFunction<T, O = any> = (this: O, on: O) => T;
type ComputeFactory<T> = (key: string) => ComputeFunction<T>;
type ComputeGetter = (controller: Controller, key: string) => any;

export function from<T, R = T>(
  source: ComputeFactory<T> | Stateful,
  setter?: ComputeFunction<T>,
  argument?: boolean | ComputeGetter): R {

  return apply(
    function from(key){
      let getSource: () => Controller;
      const { subject } = this;
      const getter = argument === true
        ? pendingValue
        : argument || undefined;

      // Easy mistake, using a peer, will always be unresolved.
      if(typeof source == "symbol")
        throw Oops.PeerNotAllowed(subject, key);

      // replace source controller in-case different
      if(typeof source == "object")
        getSource = () => control(source);

      // specifically an arrow function (getter factory)
      else if(!source.prototype){
        setter = source.call(subject, key);
        getSource = () => this;
      }

      // Regular function is too ambiguous so not allowed.
      else
        throw Oops.BadComputedSource(subject, key, source);

      Computed.prepare(this, key, getSource, setter!, getter);
    }
  )
}