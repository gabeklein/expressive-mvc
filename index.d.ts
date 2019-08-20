import {
    FunctionComponentElement,
    ProviderProps,
    Context,
} from 'react';

interface BunchOf<T> {
	[key: string]: T;
}

type ExpectsParams<A extends any[]> = new(...args: A) => any
  
/**
 * LiveState
 * 
 * State based on source schema `T`.
 * 
 * All values have getter-setter pair, setter will shallow compare and trigger update of react-component consumer.
 * 
 * Methods (ala `@actions`) have access to live values and may update them for same effect.
 * 
 */
interface LiveState {
    /**
     * Trigger update of consumer component.
     * 
     * I forget why I expose this.
     * Drink Responsibly.
     * 
     */
    refresh(): void;

    /**
     * Clone live state into new object.
     * 
     * @returns Clone - Side-effect safe object containing all enumerable values of current state.
     * 
     */
    export(): { [P in keyof this]: this[P] };

    /**
     * Add new tracked value to expressive.
     * 
     * Will trigger renders on updates to this new value.
     * 
     * @returns boolean - Did add operation succeed. `false` means value already exists or is reserved.
     * 
     */
    add(key: string, initial?: any, bootup?: true): boolean;
}

/**
 * LiveState Controller Hook.
 * 
 * @param init Controller Class
 * Class properties determine what values are live. 
 * 
 * Note: Properties starting with _ will not trigger any re-renders.
 * 
 * @returns {LiveState} Live state: interactive state of component.
 * 
 */
declare function use<I, A extends any[]>(init: { new (...args: A): I; }, ...args: A): LiveState & I;

/**
 * LiveState React Hook 
 * Returned object sets initial state, and determines what values are live.
 * 
 * Any value initialized will be included as getter-setter pair on returned object.
 * Updates to values on state object will trigger a re-render.
 * 
 * Initializer function which returns state at mount. Runs only once.
 * 
 * @param init Initial values or initializer (returning those values) of resulting state.
 * 
 * @returns {LiveState} Live state: current state of component.
 * 
 */
declare function use<I, A extends any[]>(init: (...args: A) => I, ...args: A): LiveState & I;
declare function use<I>(init: I): LiveState & I;

interface Class {
    new (...args: any): any;
}

interface Controller extends LiveState {}

declare class Controller {

    didMount?(): void;
    willUnmount?(): void;

    Provider(): FunctionComponentElement<ProviderProps<this>>

    /** 
     * Proxy for `this` controller when destructuring. 
     * 
     * Reserved: Setting this will not pass through to your components.
     */
    set: this;

    /** 
     * Arguments add listed properties to watch list for live-reload for this component.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    on(...properties: string[]): this;

    /** 
     * Arguments determine what properties should NOT be watched, despite what automatic inference sees. 
     * Use this to optimize when you refresh by ingoring unnecessary values which still may be used to render.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    not(...properties: string[]): this;
    
    /** 
     * Arguments determine entirely what properties will be watched for this component.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    only(...properties: string[]): this;
    
    /** 
     * Disable automatic reload on all properties for this component.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    once(): this;
    
    /** You're probably looking for `.not`*/
    except: never;

    /**
     * Create instance of this class and generate live-state. Arguments are forwarded to `constructor()`.
     * 
     * Returns hooked instance of state-controller.
     * 
     * To access Provider, use `.create(...)` or pull `{ Provider }` from returned controller.
     * 
     * Use `.once`, `.only`, `.on` and/or `.not` or to control which properties trigger a refresh.
     */
    static use<T extends ExpectsParams<A>, A extends any[]>(this: T, ...args: A): InstanceType<T>; 

    /**
     * Create instance of this class and generate live-state. 
     * Arguments are forwarded to `constructor()`.
     * 
     * Returns `Provider` component containing instance of state.
     * 
     * Access this state by creating an access hook using `[this].hook()`
     */
    static create<T extends ExpectsParams<A>, A extends any[]>(this: T, ...args: A): FunctionComponentElement<ProviderProps<T>>; 
    
    /**
     * Returns context assigned to this controller group.
     * 
     * If one does not already exist, it will be created.
     */
    static context<T extends Class>(this: T): Context<T>;

    /**
     * Returns accessor-hook to use in your components.
     * 
     * Hook returns instance of nearest provided state-controller.
     */
    static hook<T extends Class>(this: T): () => InstanceType<T>;

    /**
     * Create instance of this class and generate live-state. 
     * Arguments add listed properties to watch list for live-reload.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).on(...properties)`
     * 
     * Returns hooked instance of state-controller.
     */
    static useOn<T extends Class>(this: T, ...properties: string[]): () => InstanceType<T>;

    /**
     * Create instance of this class and generate live-state. 
     * Arguments determine entirely what properties will be watched.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).only(...properties)`
     * 
     * Returns hooked instance of state-controller.
     */
    static useOnly<T extends Class>(this: T, ...properties: string[]): () => InstanceType<T>;

    /**
     * Create instance of this class and generate live-state. 
     * Arguments determine what properties should NOT be watched, despite what automatic inference sees. 
     * Use this to optimize when you refresh by ingoring unnecessary values which still may be used to render.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).not(...properties)`
     * 
     * Returns hooked instance of state-controller.
     */
    static useExcept<T extends Class>(this: T, ...properties: string[]): () => InstanceType<T>;

    /**
     * Create instance of this class and generate live-state. 
     * Automatic reload will be disabled on all properties.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).once()`
     * 
     * Returns hooked instance of state-controller.
     */
    static useOnce<T extends Class>(this: T): () => InstanceType<T>;

    /**
     * You probably want `.useExcept()`
     */
    static useNot: never;
}

export { 
    use,
    Controller as default
}