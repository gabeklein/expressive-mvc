import type { Intrinsics, Style } from './dom/types';

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    intrinsics: Intrinsics;
  }

  namespace JSX {
    interface IntrinsicAttributes {
      style?: Style;
    }
  }
}

export * from './node/jsx-runtime';
