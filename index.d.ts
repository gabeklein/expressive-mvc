interface BunchOf<T> {
	[key: string]: T;
}

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
     * Drink Responibly.
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
     * @returns boolean - Did add opperation succeed. `false` means value already exists or is reserved.
     * 
     */
    add(key: string, initial?: any, bootup?: true): boolean;
}

/**
 * @param {LiveState} this - LiveState, allows the updating of state from inside initializer.
 * @param {LiveState} onUnmount - adds EventListener, call with function as argument to set unmount callback.
 * @param {LiveState} state - [this] LiveState, allows the updating of state from inside initializer.
 * 
 * NOTE: `this` and `self` are only really initialized when accessed by closure!
 * 
 * @returns Initial values, and more importantly schema, for live state.
 * 
 */
type InitStateOnMount<I extends BunchOf<any>, S = LiveState & I> =
    (this: S, onUnmount: (cb: VoidFunction) => void, state: S) => I

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
 * @param init Initital values or initializer (returning those values) of resulting state.
 * 
 * @returns {LiveState} Live state: current state of component.
 * 
 */
declare function use<I, A extends any[]>(init: (...args: A) => I, ...args: A): LiveState & I;
declare function use<I>(init: I): LiveState & I;

export { 
    use, 
    use as useStates,
    use as useController
}