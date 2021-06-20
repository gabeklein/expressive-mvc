export {
  setChild as use,
  setParent as parent,
  setPeer as tap,
  setEffect as on,
  setRefMediator as ref,
  setAction as act,
  setComputed as from,
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
  Singleton
} from './singleton';