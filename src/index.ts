export {
  setChild as use,
  setParent as parent,
  setPeer as tap,
  setEffect as on,
  setRefObject as ref,
  setAction as act,
  setMemo as memo,
  setIgnored as lazy
} from './modifiers';

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