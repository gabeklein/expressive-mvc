import { Consumer, ReactElement, ReactNode } from "react";
import { Model } from "./model"
import { Class } from "./types";

export namespace Provider {
    type Item = Model | typeof Model;
    type Collection<T extends Item> = T[] | { [key: string]: T };
    type Existent<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;
    
    type NormalProps<E, I = Existent<E>> =
        & { of: E, children: ReactNode | ((instance: I) => ReactNode) }
        & Model.Compat<I>;

    // FIX: This fails to exclude properties with same key but different type.
    type MultipleProps<T extends Item> =
        & { of: Collection<T>, children?: ReactNode | (() => ReactNode) }
        & Model.Compat<Existent<T>>;

    type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

export function Provider<T extends Provider.Item>(props: Provider.Props<T>): ReactElement<typeof props>;

export namespace Consumer {
    type HasProps<E extends Class> = {
        /** Type of controller to fetch from context. */
        of: E;
        /**
         * Getter function. Is called on every natural render of this component.
         * Will throw if usable instance cannot be found in context.
         */
        has: (value: InstanceType<E>) => void;
    }
    
    type GetProps<E extends Class> = {
        /** Type of controller to fetch from context. */
        of: E;
        /** Getter function. Is called on every natural render of this component. */
        get: (value: InstanceType<E> | undefined) => void;
    }
    
    type RenderProps<E extends Class> = {
        /** Type of controller to fetch from context. */
        of: E;
        /**
         * Render function, will receive instance of desired controller.
         *
         * Similar to `tap()`, updates to properties accessed in
         * this function will cause a refresh when they change.
         */
        children: (value: InstanceType<E>) => ReactElement<any, any> | null;
    }

    type Props<T extends Class> = HasProps<T> | GetProps<T> | RenderProps<T>
}

export function Consumer<T extends Class>(props: Consumer.Props<T>): null;