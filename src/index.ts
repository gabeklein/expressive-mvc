export {
  setEffect as on,
  setRefMediator as ref,
  setAction as act,
  setComputed as from,
  setMemo as memo,
  setIgnored as lazy
} from './instructions';

export {
  setChild as use,
  setParent as parent
} from './compose';

export {
  setPeer as tap
} from './peer';

export {
  set
} from './controller';

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