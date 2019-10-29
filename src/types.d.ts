export type BunchOf<T> = { [key: string]: T }

export type State = LiveState & BunchOf<any>

export type Class = new(...args: any[]) => any;

export type UpdateTrigger = (beat: number) => void;

export interface LiveState<State = any> {
  refresh(): void;
  add(key: string, initial?: any): void;
  export(): State;
}

export interface Lifecycle {
  willUnmount?: () => void
  didMount?: () => void
}