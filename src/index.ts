import { useEffect, useState } from "react";
const { defineProperty, create } = Object;
const { random } = Math;

class LiveState {
    constructor(
        public refresh: VoidFunction
    ){}

    export<Clone = { [P in keyof this]: this[P] }>(): Clone {
        return create(this)
    }
}

function bootstrap(
    init: any, 
    live: any, 
    onUpdate: (beat: number) => void){

    if(typeof init == "function")
        init = init.call(live, live);

    const store = {} as typeof init;
    for(const key in init)
        if(typeof init[key] == "function")
            defineProperty(live, key, {
                value: init[key]
            })
        else {
            store[key] = init[key];
            defineProperty(live, key, {
                get: () => store[key],
                set: (value) => { 
                    if(store[key] === value) 
                        return;

                    store[key] = value;
                    onUpdate(random())
                },
                enumerable: true,
                configurable: true
            })
        }
}

export function useStateful(init: any){
    const [ alreadyMounted, didMount ] = useState(false);
    const [ , refresh] = useState(0);
    const [ live ] = useState(new LiveState(refresh));

    if(!alreadyMounted)
        bootstrap(init, live, refresh)

    useEffect(() => {
        didMount(true);
    }, []);

    return live;
}