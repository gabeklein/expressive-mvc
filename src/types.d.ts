type BunchOf<T> = { [key: string]: T };
type Callback = () => void;
type Class = new (...args: any[]) => any;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;
type RequestCallback = (keys: readonly string[]) => void;