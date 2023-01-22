export type Callback = () => void;
export type Class = new (...args: any[]) => any;
export type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

/** Type may not be undefined - instead will be null.  */
export type NoVoid<T> = T extends undefined ? null : T;