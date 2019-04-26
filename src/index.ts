import { useState, useEffect } from 'react';

const { create, defineProperty, getOwnPropertyDescriptor } = Object;
const { random } = Math;

type BunchOf<T> = { [key: string]: any }

type State = LiveState & BunchOf<any>

type StateInitializer = (
    this: typeof LiveState, 
    callback: (cb: VoidFunction) => void, 
    self: typeof LiveState
) => State;

interface LiveState extends BunchOf<any> {
    __store__: any;
    __update__: (beat: number) => void;  
    refresh(): void;
    export(): { [P in keyof this]: this[P] };
    add(key: string, initial?: any, bootup?: true): boolean;
}

const LiveState = {
    refresh(this: LiveState){
        this.__update__(random() + 1e-5)
    },

    export(this: LiveState & BunchOf<any>): typeof this {
        return create(this as any)
    },

    add(this: LiveState, key: string, initial?: any, bootup?: true){
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
    live: LiveState,
    registerUnmount: (cb: VoidFunction) => void){

    if(typeof init !== "function")
        init = init;
    else
        init = (init as StateInitializer).call(
            live, 
            registerUnmount,
            live
        );

    const source = create(init);

    Object.setPrototypeOf(live, source);
    source.__store__ = init;

    for(const method in LiveState)
        defineProperty(source, method, {
            value: (<any>LiveState)[method]
        })
    
    for(const key in init){
        if(key in LiveState)
            throw new Error(
                `Can't bootstrap ${key} onto live state, it is reserved!`
            )

        const desc = Object.getOwnPropertyDescriptor(init, key)!;
        if(desc.get || desc.set)
            continue

        const value = desc.value;

        if(typeof value == "function")
            defineProperty(live, key, {
                value: (<Function>value).bind(live)
            })
        else
            live.add(key, value, true);
    }
}

export const useStateful = (() => {

    let callbackUnmount: VoidFunction | undefined;

    return function useStateful(init: any){
        let [ beat, update ] = useState(0);
        const [ live ] = useState({ 
            __update__: update
        });
    
        if(beat == 0){
            if(!init) throw new Error(
                "useStateful needs some form of intializer."
            )
            bootstrap(
                init, 
                live,
                (x: VoidFunction) => { callbackUnmount = x }
            )
            beat = 1;
        }

        useEffect(() => {
            const onUnmount = callbackUnmount;
            callbackUnmount = undefined;
            if(typeof onUnmount === "function")
                return onUnmount
        }, [])
    
        return live;
    }
})()
 