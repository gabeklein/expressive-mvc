export {
  setChild as use,
  setParent as parent,
  setPeer as tap,
  setEffect as on,
  setRefObject as ref,
  setAction as act,
  setMemo as memo,
  setIgnored as lazy,
  setTuple as tuple
} from './modifiers';

export {
  setBoundComponent as bind
} from './bind';

export {
  setComponent as hoc,
  setParentComponent as wrap
} from './hoc';

export {
  Consumer,
  Provider
} from './context';

export {
  Model,
  Model as default
} from './model';

export {
  Singleton,
  Singleton as GC
} from './singleton';