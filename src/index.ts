import { useState, useEffect } from 'react';

const { create, defineProperty, getOwnPropertyDescriptor } = Object;
const { random } = Math;

type BunchOf<T> = { [key: string]: any }

type State = LiveState & BunchOf<any>

type StateInitializer = (
    this: typeof LiveState, 
    callback: VoidFunction, 
    self: typeof LiveState
) => State;

class LiveState {

    static __store__: any;
    static __update__: (beat: number) => void;  

    static refresh(){
        this.__update__(random() + 1e-5)
    }

    static export<T, Clone = { [P in keyof T]: T[P] }>(this: T): Clone {
        return create(this as any)
    }

    static add(key: string, initial?: any, bootup?: true){
        if(getOwnPropertyDescriptor(this, key))
            return false;

        this.__store__[key] = initial;
        defineProperty(this, key, {
            get: () => this.__store__[key],
            set: (value) => { 
                if(this.__store__[key] === value) 
                    return;

                this.__store__[key] = value;
                this.refresh()
            },
            enumerable: true,
            configurable: true
        })
        if(!bootup)
            this.refresh();

        return true
    }
}

function bootstrap(
    init: StateInitializer | State, 
    live: typeof LiveState,
    cleanup: Function){

    if(typeof init == "function")
        init = init.call(
            live, 
            (callback: VoidFunction) => { cleanup(callback) },
            live
        ) as State;

    const source = create(init);

    Object.setPrototypeOf(live, source);

    for(const method in LiveState)
        defineProperty(source, method, {
            value: (<any>LiveState)[method]
        })
    
    for(const key in init){
        if(key in LiveState)
            throw new Error(
                `Can't bootstrap ${key} onto live state, it is reserved!`
            )

        const value = init[key]

        if(typeof value == "function")
            defineProperty(live, key, {
                value: (<Function>value).bind(live)
            })
        else
            live.add(key, value, true);
    }
}

export const useStateful = (() => {

    let unmount: VoidFunction | undefined;

    return function useStateful(init: any){
        let [ beat, update ] = useState(0);
        const [ live ] = useState({ 
            __update__: update
        });
    
        if(beat == 0){
            if(init) throw new Error(
                "It's `useStateful` not `useStateless`!\nYou need an initializer with atleast one value ideally."
            )
            bootstrap(
                init, 
                live,
                (x: VoidFunction) => { unmount = x }
            )
            beat = 1;
        }

        useEffect(() => {
            const cleanupHandler = unmount;
            unmount = undefined;
            if(typeof cleanupHandler === "function")
                return cleanupHandler()
        })
    
        return live;
    }
})()
 