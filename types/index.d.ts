/// <reference path="common.d.ts" />

export {
    Controller,
    Controller as VC,
    Controller as default,
    Singleton,
    Singleton as GC
} from './controller';

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
    setEvent as event,
    setComponent as hoc,
    setParentComponent as wrap,
    setBoundComponent as bind,
    setMemo as memo,
    setValue as def,
    setIgnored as lazy,
    setTuple as tuple
} from "./directives";