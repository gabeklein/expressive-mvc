/// <reference path="common.d.ts" />

export {
    Model,
    Model as default,
    Singleton,
    Singleton as GC
} from './model';

export {
    Consumer,
    Provider
} from './react';

export {
    setChild as use,
    setParent as parent,
    setPeer as tap,
    setEffect as watch,
    setReference as ref,
    setAction as act,
    setComponent as hoc,
    setParentComponent as wrap,
    setBoundComponent as bind,
    setMemo as memo,
    setIgnored as lazy,
    setTuple as tuple
} from "./modifiers";

export {
    Selector
} from './selector'