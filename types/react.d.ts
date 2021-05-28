import { ReactElement } from "react";
import { Model } from "./controller"

type ComponentOutput = ReactElement<any, any> | null;

type ProviderOfProps = { of: Class[] | { [key: string]: Class } }

type ProviderForProps<E> = E extends Class
    ? ({ of: E, children?: React.ReactNode } & Model.Data<InstanceType<E>>)
    | ({ of: E, children?: (instance: InstanceType<E>) => React.ReactNode } & Model.Data<InstanceType<E>>)
    : ({ of: E, children?: React.ReactNode } & Model.Data<E>);

type ConsumerProps<E extends Class> = 
    | {
        /** Type of controller to fetch from context. */
        of: E;
        /** 
         * Getter function. Is called on every natural render of this component.
         * Will throw if usable instance cannot be found in context.
         */
        has: (value: InstanceType<E>) => void;
    }
    | {
        /** Type of controller to fetch from context. */
        of: E;
        /** Getter function. Is called on every natural render of this component. */
        get: (value: InstanceType<E> | undefined) => void;
    }
    | {
        /** Type of controller to fetch from context. */
        of: E;
        /**
         * Render function, will receive instance of desired controller.
         * 
         * Similar to `tap()`, updates to properties accessed in
         * this function will cause a refresh when they change.
         */
        children: (value: InstanceType<E>) => ComponentOutput;
    }

export const Provider: <T>(props: ProviderForProps<T>) => ComponentOutput;
export const Consumer: <T extends Class>(props: ConsumerProps<T>) => ComponentOutput;