import { ReactElement } from "react";
import { Model } from "./model"
import { Class } from "./types";

type Instance<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;
type ComponentOutput = ReactElement<any, any> | null;

type NormalProviderProps<E, I = Instance<E>> =
    & { of: E, children: React.ReactNode | ((instance: I) => React.ReactNode) }
    & Model.Data<I>;

type ProvideItem = Model | typeof Model;
type ProvideCollection<T extends ProvideItem = ProvideItem> = T[] | { [key: string]: T };
type ProviderChildren = React.ReactNode | (() => React.ReactNode);

// FIX: This fails to exclude properties with same key but different type.
type MultipleProviderProps<T extends ProvideItem> =
    & { of: ProvideCollection<T>, children?: ProviderChildren }
    & Model.Data<T>;

declare function Provider<T extends ProvideItem>(
    props: NormalProviderProps<T> | MultipleProviderProps<T>
): ComponentOutput;

type ConsumerHasProps<E extends Class> = {
    /** Type of controller to fetch from context. */
    of: E;
    /** 
     * Getter function. Is called on every natural render of this component.
     * Will throw if usable instance cannot be found in context.
     */
    has: (value: InstanceType<E>) => void;
}

type ConsumerGetProps<E extends Class> = {
    /** Type of controller to fetch from context. */
    of: E;
    /** Getter function. Is called on every natural render of this component. */
    get: (value: InstanceType<E> | undefined) => void;
}

type ConsumerRenderProps<E extends Class> = {
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

declare function Consumer<T extends Class>(
    props: ConsumerHasProps<T> | ConsumerGetProps<T> | ConsumerRenderProps<T>
): ComponentOutput;

export { Consumer, Provider }