import { useState, useEffect, useRef } from 'react';

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
    __active__: boolean;
    refresh(): void;
    export(): { [P in keyof this]: this[P] };
    add(key: string, initial?: any, bootup?: true): boolean;
}

const LiveState = {
    refresh(this: LiveState){
        this.__active__ = true;
        this.__update__(random() + 1e-5)
    },

    export(this: LiveState & BunchOf<any>): typeof this {
        return create(this as any)
    },

    add(this: LiveState, key: string, initial?: any){
        if(getOwnPropertyDescriptor(this, key))
            return false;

        this.__store__[key] = initial;
        defineProperty(this, key, {
            get: () => this.__store__[key],
            set: (value) => {
                if(this.__store__[key] === value) 
                    return;

                this.__store__[key] = value;
                if(this.__active__ == false)
                    this.refresh()
            },
            enumerable: true,
            configurable: true
        })
        if(this.__active__ === false){
            this.refresh();
            this.__active__ = true;
        }

        return true
    }
}

function bootstrap(
    init: StateInitializer | State, 
    live: LiveState,
    registerUnmount: (cb: VoidFunction) => void){

    if(typeof init == "function")
        init = init.apply(live, [
            registerUnmount,
            live
        ]);

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
                value: (<Function>value).bind(live),
                configurable: true
            })
        else 
            live.add(key, value);
    }
}

export const useStateful = (() => {

    let callbackUnmount: VoidFunction | undefined;

    return function useStateful(init: any){
        let update = useState(0)[1];
        const { current: live } = useRef({ 
            __update__: update,
            __active__: null
        });
    
        if(live.__active__ === null){
            if(!init) throw new Error(
                "useStateful needs some form of intializer."
            )
            bootstrap(
                init, 
                live,
                (x: VoidFunction) => { callbackUnmount = x }
            )
        }

        live.__active__ = false;

        useEffect(() => {
            live.__active__ = false;
            const onUnmount = callbackUnmount;
            callbackUnmount = undefined;
            return () => {
                if(onUnmount)
                    onUnmount();
                for(const key in live)
                    try { delete live[key] }
                    catch(err) {}
            }
        }, [])
    
        return live;
    }
})()

export { useStateful as useStates }
 