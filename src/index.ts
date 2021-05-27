export {
  setChild as use,
  setParent as parent,
  setPeer as tap,
  setEffect as watch,
  setRefObject as ref,
  setAction as act,
  setEvent as event,
  setComponent as hoc,
  setParentComponent as wrap,
  setMemo as memo,
  setIgnored as lazy,
  setTuple as tuple
} from './directives';

export {
  setBoundComponent as bind
} from './binding';

export {
  Controller,
  Controller as VC,
  Controller as default
} from './controller';

export {
  Singleton,
  Singleton as GC
} from './singleton';

export {
  Consumer,
  Provider
} from './context';