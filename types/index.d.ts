export {
    Model,
    Model as default,
    Singleton
} from './model';

export {
    Consumer,
    Provider
} from './react';

export {
    setChild as use,
    setParent as parent,
    setPeer as tap,
    setEffect as on,
    setReference as ref,
    setAction as act,
    setMemo as memo,
    setIgnored as lazy
} from "./modifiers";

export {
    Selector
} from './selector'