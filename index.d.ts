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
    refresh: VoidFunction;

    /**
     * Clone live state into new object.
     * 
     * @returns Clone - Side-effect safe object containing all enumerable values of current state.
     * 
     */
    export<Clone = { [P in keyof this]: this[P] }>(): Clone;
}

/**
 * LiveState React Hook.
 * 
 * Any value initialized will be included as getter-setter pair on returned object.
 * Updates to values on state object will trigger a re-render.
 * 
 * Accepts object (initializer) or function which returns initializer.
 * Init function is called only on mount, so may be used as such.
 * 
 * @param init State initializer.
 * Sets initial, and determines what values are live.
 * 
 * @returns {LiveState} Live state: current state of component.
 * 
 */
declare function useStateful
    <I extends BunchOf<any>>
    (init: I): LiveState & I;

/**
 * @param {LiveState} this - Live State, allows the updating of state from inside initializer.
 * @param {LiveState} live - Same as above.
 * 
 * NOTE: `live` is only fully initialized only if accessed by closure!
 * 
 * @returns Initial values, and more importantly schema, for live state.
 * 
 */
type InitStateOnMount<I extends BunchOf<any>, S = LiveState & I> =
    (this: S, state: S) => I

/**
 * LiveState React Hook 
 * Returned object sets initial state, and determines what values are live.
 * 
 * Any value initialized will be included as getter-setter pair on returned object.
 * Updates to values on state object will trigger a re-render.
 * 
 * Initializer function which returns state at mount. Runs only once.
 * 
 * @param {InitStateOnMount} init State initializer. (Functionally `ComponentDidMount`)
 * 
 * @returns {LiveState} Live state: current state of component.
 * 
 */
declare function useStateful
    <I extends BunchOf<any>, S = LiveState & I> (
    init: InitStateOnMount<I, S>
): S;