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
    let base: LiveState<any> & Lifecycle;

    if(init.prototype){
        const { prototype } = init;

        base = new init(...args);

        applyUnmount({ 
            willUnmount: base.willUnmount || prototype.willUnmount, 
            didMount: base.didMount || prototype.willUnmount
        });
    }
    else {
        if(typeof init == "function")
            init = init(...args);

        const { willUnmount, didMount, ...values } = init;
        applyUnmount({ willUnmount, didMount });
        base = values;
    }

    applyLiveState(base, update);
    bootstrapForIn(base);

    return base as State & LiveState;
}

function useSimpleEnclosure(){
    let cycle = {} as Lifecycle;

    return function useSimpleController(init: any, ...args: any[]){
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
}

export const use = useSimpleEnclosure()