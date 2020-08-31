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

/**
 * Workaround to retreive `typeof this`
 * in static methods using generics.
 */
type Class = new(...args: any[]) => any;