import { ReactElement } from "react";
import { Model } from "./model"
import { Class } from "./types";

type Instance<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;
type ComponentOutput = ReactElement<any, any> | null;

type ProvideCollection =
    | (Model | typeof Model)[]
    | { [key: string]: Model | typeof Model }

type ProviderProps<E, I = Instance<E>> = 
    | ({ of: E, children: React.ReactNode | ((instance: I) => React.ReactNode) } & Model.Data<I>)
    | ({ of: ProvideCollection, children?: React.ReactNode })

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

declare function Provider<T>(props: ProviderProps<T>): ComponentOutput;
declare function Consumer<T extends Class>(props: ConsumerProps<T>): ComponentOutput;

export { Consumer, Provider };