import { ReactNode } from "react";

export { Consumer, Model, Provider, get, use, has, ref, set } from "core";

declare module "./base.d.ts" {
  namespace Pragma {
    interface FC<P> {
      (props: P, context?: any): ReactNode;
      displayName?: string | undefined;
    }

    interface ComponentProps {
      children?: ReactNode;
    }

    interface RenderProps<T> {
      children: (props: T) => ReactNode;
    }
  }
}