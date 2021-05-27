export {
  setChild as use,
  setParent as parent,
  setPeer as tap,
  setEffect as watch,
  setRefObject as ref,
  setAction as act,
  setEvent as event,
  setMemo as memo,
  setIgnored as lazy,
  setTuple as tuple
} from './directives';

export {
  setBoundComponent as bind
} from './binding';

export {
  setComponent as hoc,
  setParentComponent as wrap
} from './hoc';

export {
  Consumer,
  Provider
} from './context';

export {
  Controller,
  Controller as VC,
  Controller as default
} from './controller';

export {
  Singleton,
  Singleton as GC
} from './singleton';