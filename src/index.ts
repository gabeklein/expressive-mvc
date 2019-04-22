import { useEffect, useState } from "react";
const { defineProperty } = Object;
const { random } = Math;

function bootstrap(
    init: any, 
    live: any, 
    onUpdate: (beat: number) => void){

    if(typeof init == "function")
        init = init();

    const store = {...init};
    for(const key in init)
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

export function useStateful(init: any){
    const [ alreadyMounted, didMount ] = useState(false);
    const [ , refresh] = useState(0);
    const [ live ] = useState({});

    if(!alreadyMounted)
        bootstrap(init, live, refresh)

    useEffect(() => {
        didMount(true);
    }, []);

    return live;
}