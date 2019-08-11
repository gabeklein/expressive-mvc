import { Controller } from "./controller";

export type BunchOf<T> = { [key: string]: any }

export type State = LiveState & BunchOf<any>

export interface LiveState<State = any> {
    refresh(): void;
    add(key: string, initial?: any): void;
    export(): State;
}

export interface Lifecycle {
    willUnmount?: VoidFunction
    didMount?: VoidFunction
}