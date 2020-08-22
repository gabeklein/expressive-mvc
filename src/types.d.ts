type BunchOf<T> = { [key: string]: T };
type Callback = () => void;
type Class = new(...args: any[]) => any;