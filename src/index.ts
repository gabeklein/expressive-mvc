import { useEffect, useState } from "react";
const { defineProperty } = Object;
const { random } = Math;

function encapsulate(
    init: any, 
    live: any, 
    refresh: [never, (beat: number) => void]){

    const [, didUpdate] = refresh;
    const store = {...init};
    for(const key in init)
        defineProperty(live, key, {
            get: () => store[key],
            set: (value) => { 
                store[key] = value;
                didUpdate(random())
            }
        })
}

export function useStateful(init: any){
    const [ alreadyMounted, didMount ] = useState(false);
    const refresh = useState(0);
    const [ live ] = useState({});

    if(!alreadyMounted)
        encapsulate(init, live, refresh)

    useEffect(() => didMount(true), [])

    return live;
}