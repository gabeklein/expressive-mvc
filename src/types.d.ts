/**
 * Any object containing arbirary properties of type {T}.
 */
type BunchOf<T> = { [key: string]: T };

/** 
 * Helper generic, allows errors-free access 
 * to arbitrary properties in an object. 
 */
type Any = { [key: string]: any };

/**
 * Any function to fire off some expected action.
 */
type Callback = () => void;


type EffectCallback = (...args: any[]) => (Callback | undefined);

/**
 * Workaround to retreive `typeof this`
 * in static methods using generics.
 */
type Class = new(...args: any[]) => any;

type maybeStrings = Array<string | undefined>;

type Recursive<T = any> = { [P in keyof T]: Recursive<T> };

type Selector<T = any>= (list: Recursive<T>) => void;

type HandleUpdatedValue
  <T extends object = any, P extends keyof T = any> = 
  (this: T, value: T[P], changed: P) => void;