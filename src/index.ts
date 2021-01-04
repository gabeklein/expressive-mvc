export {
  childProperty as use,
  parentProperty as parent,
  peerProperty as get,
  effectProperty as watch,
  refProperty as ref,
  actionProperty as act,
  eventProperty as event,
  componentProperty as hoc,
  parentComponentProperty as wrap,
  memoizedProperty as memo,
  boundComponentProperty as bind,
  defineValueProperty as def,
  passiveProperty as omit,
  tupleProperty as tuple
} from './directives';

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
  InsertProvider as Provider
} from './context';