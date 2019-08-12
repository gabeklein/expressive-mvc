import { useEffect, useRef, useState } from 'react';

import { bootstrapForIn, applyLiveState } from './bootstrap';
import { invokeLifecycle } from './helper';
import { Lifecycle, LiveState, State } from './types.d';

function bootstrapFromSource(
    init: any,
    args: any[],
    update: (x: any) => void,
    applyUnmount: (lc: Lifecycle) => void
){
    let baseLayer: any;
    let methods: any;

    if(init.prototype){
        let { constructor: _, willUnmount, didMount, ...prototype } = 
            init.prototype as Lifecycle;

        methods = prototype;
        init = new init(...args);
        
        const { willUnmount: will, didMount: did } = init;

        if(will){ willUnmount = will }
        if(did){ didMount = did }

        applyUnmount({ willUnmount, didMount });
        baseLayer = init;
    }
    else {
        if(typeof init == "function")
            init = init(...args);

        const { willUnmount, didMount, ...values } = init;
        applyUnmount({ willUnmount, didMount });
        baseLayer = values;
    }

    applyLiveState(baseLayer, update);
    bootstrapForIn(baseLayer, methods, Object.prototype);

    return baseLayer as State & LiveState;
}

export const use = (() => {

    let cycle = {} as Lifecycle;

    return function useController(init: any, ...args: any[]){
        const update = useState(0);
        const ref = useRef(null) as any;

        let live = ref.current;

        if(live === null){
            if(!init) throw new Error(
                "useStateful needs some form of intializer."
            )
            live = ref.current = 
                bootstrapFromSource(
                    init, args, update[1], 
                    (lc: Lifecycle) => { cycle = lc }
                )
        }

        useEffect(() => {
            const { didMount, willUnmount } = cycle;
            return invokeLifecycle(live, didMount, willUnmount)
        }, [])

        return live;
    }
})()