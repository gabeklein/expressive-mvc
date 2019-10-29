import {
    FunctionComponentElement,
    ProviderProps,
    Context,
} from 'react';

interface BunchOf<T> { [key: string]: T }

type Class = new (...args: any) => any;
type ExpectsParams<A extends any[]> = new(...args: A) => any

/**
 * General-purpose Controller hook.
 * 
 * @param define ModelController Class Definition
 * 
 * @returns {LiveState} Reference to bound ModelController.
 */
declare function use<I, A extends any[]>(define: { new (...args: A): I; }, ...args: A): Controller & I;

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
 */
declare function use<I, A extends any[]>(init: (...args: A) => I, ...args: A): Controller & I;
declare function use<I>(init: I): Controller & I;

interface SpyController<T> {
    /** 
     * Arguments add listed properties to watch list for live-reload for this component.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    on(...properties: string[]): SpyController<T> | T;

    /** 
     * Arguments determine what properties should NOT be watched, despite what automatic inference sees. 
     * Use this to optimize when you refresh by ingoring unnecessary values which still are used to render.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    not(...properties: string[]): SpyController<T> | T;
    
    /** 
     * Arguments determine entirely what properties will be watched for this component.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    only(...properties: string[]): T;
    
    /** 
     * Disable automatic reload on all properties for this component.
     * 
     * Reserved: Overrides of this method will be ignored. 
     */
    once(): T;
    
    /** 
     * You're probably looking for `.not`
     */
    except: never;
}

interface Controller {
    /**
     * Trigger update of consumer component.
     * 
     * I forget why I expose this.
     * Drink Responsibly.
     */
    refresh(...keys: string[]): void;

    /**
     * Clone live state into new object.
     * 
     * @returns Clone - Side-effect safe object containing all enumerable values of current state.
     */
    export(): { [P in keyof this]: this[P] };

    /**
     * Add new tracked value to state-controller.
     * 
     * Will trigger renders on updates to this new value.
     * 
     * @returns boolean - Did add operation succeed. `false` means value already exists or is reserved.
     */
    add(key: string, initial?: any, bootup?: true): boolean;
}

declare class Controller {
    /**
     * Lifecycle Method
     * 
     * Will be run once at mounting of this component. `useEvent()` surrogate for `comonentDidMount()`.
     */
    didMount?(): void;

    /**
     * Lifecycle Method
     * 
     * Will be run before unmounting completes in this component. `useEvent()` surrogate for `comonentWillUnmount()`.
     */
    willUnmount?(): void;

    /**
     * Lifecycle Method
     * 
     * Will be run at every render, however `this` will only reflect the controller at initial invocation (right after construction, right before live-state).
     * To accomodate hook sensitivity, function will still run on subsequent renders, however bound on an empty object.
     * 
     * As such you may set properties from hook-based retreival (i.e. `useContext()`) without concern they will be repeatedly updated by the hook and/or may change due to an externality. Values you set in this function will also be trackable.
     */
    didHook?(): void;
    
    /**
     * Lifecycle Method
     * 
     * Will be run on every render, unlike in `didHook`, `this` will always reflect instance of this controller. While executing this method however (async not withstanding), any value set *will not* dispatch an update. That's disabled because it only ever runs at the beginning of a new render.
     * 
     * If you must update the controller during this phase, set `this.hold` to false.

     * **Drink responsibly**: Doing that may cause an infinte loop!
     */
    willHook?(): void;

    Provider(): FunctionComponentElement<ProviderProps<this>>
    
    /** **Reserved** - Used by subscription driver. */
    on(): this;
    /** **Reserved** - Used by subscription driver. */
    once(): this;
    /** **Reserved** - Used by subscription driver. */
    only(): this;
    /** **Reserved** - Used by subscription driver. */
    not(): this;
    /** 
     * **Reserved** - (not actually) used by subscription driver. 
     * 
     * You probably mean `not`
     * */
    except: never;

    /**
     * Freeze status of render updates. Proxy to value used by debounce system. Also usable to temporarily prevent updates from dispatching from this controller.
     */
    hold: boolean;

    /** 
     * **Reserved**
     * 
     * Proxy for `this` controller when destructuring. 
     */
    set: this;

    /** 
     * **Reserved**
     * 
     * Proxy for `this` controller when destructuring. 
     */
    get: this;

    /**
     * Initialize this controller and provide it to children.
     */
    static get Provider(): FunctionComponentElement<any>;

    /**
     * Create instance of this class and generate live-state. Arguments are forwarded to `constructor()`.
     * 
     * Returns hooked instance of state-controller.
     * 
     * To access Provider, use `.create(...)` or pull `{ Provider }` from returned controller.
     * 
     * Use `.once`, `.only`, `.on` and/or `.not` or to control which properties trigger a refresh.
     */
    static use<T extends ExpectsParams<A>, A extends any[], I = InstanceType<T>>(this: T, ...args: A): SpyController<I> & I; 

    /**
     * Get instance of this class from context. 
     * Returns parent state-controller, specially hooked to this component.
     * 
     * Chain `.once`, `.only`, `.on` and/or `.not` or to control which properties trigger a refresh here.
     */
    static get<T extends ExpectsParams<A>, A extends any[], I = InstanceType<T>>(this: T, ...args: A): SpyController<I> & I; 

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
    static context<T extends Class>(this: T): Context<InstanceType<T>>;

    /**
     * Returns accessor-hook to use in your components.
     * 
     * Hook returns instance of nearest provided state-controller.
     */
    static hook<T extends Class, I = InstanceType<T>>(this: T): SpyController<I> & I;

    /**
     * Create instance of this class and generate live-state. 
     * Arguments add listed properties to watch list for live-reload.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).on(...properties)`
     * 
     * Returns hooked instance of state-controller.
     */
    static useOn<T extends Class, I = InstanceType<T>>(this: T, ...properties: string[]): SpyController<I> & I;

    /**
     * Create instance of this class and generate live-state. 
     * Arguments determine entirely what properties will be watched.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).only(...properties)`
     * 
     * Returns hooked instance of state-controller.
     */
    static useOnly<T extends Class>(this: T, ...properties: string[]): InstanceType<T>;

    /**
     * Create instance of this class and generate live-state. 
     * Arguments determine what properties should NOT be watched, despite what automatic inference sees. 
     * 
     * Use this to optimize when you refresh by ingoring unnecessary values which still may be used to render.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).not(...properties)`
     * 
     * Returns hooked instance of state-controller.
     */
    static useExcept<T extends Class, I = InstanceType<T>>(this: T, ...properties: string[]): SpyController<I> & I;

    /**
     * Create instance of this class and generate live-state. 
     * Automatic reload will be disabled on all properties.
     * 
     * Assumes no arguments are needed. 
     * If you need to pass arguments to `constructor()` use `[this].use(...args).once()`
     * 
     * Returns hooked instance of state-controller.
     */
    static useOnce<T extends Class>(this: T): InstanceType<T>;

    /**
     * Get instance of this class from context. 
     * Returns parent state-controller, specially hooked to this component.
     * 
     * Arguments add listed properties to watch list for live-reload.
     */
    static getOn<T extends Class, I = InstanceType<T>>(this: T, ...properties: string[]): SpyController<I> & I;

    /**
     * Get instance of this class from context. 
     * Returns parent state-controller, specially hooked to this component.
     * 
     * Arguments determine entirely what properties will be watched from state in this component.
     */
    static getOnly<T extends Class>(this: T, ...properties: string[]): InstanceType<T>;

    /**
     * Get instance of this class from context. 
     * Returns parent state-controller, specially hooked to this component.
     * 
     * Arguments determine what properties should NOT be watched from state in this component, despite what automatic inference sees. 
     * 
     * Use this to optimize when you refresh by ingoring unnecessary values which still may be used to render.
     */
    static getExcept<T extends Class, I = InstanceType<T>>(this: T, ...properties: string[]): SpyController<I> & I;

    /**
     * Get instance of this class from context. 
     * Returns parent state-controller.
     * 
     * Automatic reload will be disabled on all properties.
     */
    static getOnce<T extends Class>(this: T): InstanceType<T>;

    /**
     * You probably mean `.useExcept()`
     */
    static getNot: never;
}

export { 
    use,
    Controller,
    Controller as default
}