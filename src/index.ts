export {
  setChild as use,
  setParent as parent,
  setEffect as on,
  setRefMediator as ref,
  setAction as act,
  setComputed as from,
  setMemo as memo,
  setIgnored as lazy
} from './instructions';

export {
  setBindings as binds
} from './binding';

export {
  setPeer as tap
} from './peer';

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