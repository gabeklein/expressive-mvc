interface BunchOf<T> {
	[key: string]: T;
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
 * @returns live state: current state of component.
 * 
 */
declare function useStateful<O extends BunchOf<any>>
    (init: O): { [P in keyof O]: O[P] };

/**
 * LiveState React Hook 
 * Returned object sets initial state, and determines what values are live.
 * 
 * Any value initialized will be included as getter-setter pair on returned object.
 * Updates to values on state object will trigger a re-render.
 * 
 * Initializer function which returns state at mount. Runs only once.
 * 
 * @param init State initializer. (Functionally `ComponentDidMount`)
 * 
 * @returns live state: current state of component.
 * 
 */
declare function useStateful<O extends BunchOf<any>>
    (init: () => O): { [P in keyof O]: O[P] };