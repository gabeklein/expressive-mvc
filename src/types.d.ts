export type Callback = () => void;
export type Class = new (...args: any[]) => any;
export type InstanceOf<T> = T extends { prototype: infer U } ? U : never;
export type RequestCallback<T extends string = string> = (keys: readonly T[]) => void;