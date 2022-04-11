export type Async<T = any> = (this: T, ...args: any[]) => Promise<any>;
export type BunchOf<T> = { [key: string]: T };
export type InstanceOf<T> = T extends { prototype: infer U } ? U : never;
export type Class = new (...args: any[]) => any;