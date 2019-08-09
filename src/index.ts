import { useState, useEffect, useRef } from 'react';

const { random } = Math;
const { 
    defineProperty: define, 
    getOwnPropertyDescriptor: getDesc, 
    getPrototypeOf: getProto, 
    create,
    assign
} = Object;

type BunchOf<T> = { [key: string]: any }

type State = LiveState & BunchOf<any>

interface LiveState<State = any> {
    refresh(): void;
    add(key: string, initial?: any): void;
    export(): State;
}

function LiveStateConstruct(
    this: LiveState,
    updateHook: (beat: number) => void
){
    const values = {} as BunchOf<any>;
    let pending = false;

    this.refresh = () => {
        if(pending)
            return
        pending = true;
        setTimeout(() => {
            updateHook(random());
            pending = false;
        }, 0)
    }

    this.export = () => {
        const acc = {} as BunchOf<any>;
        for(const key in this){
            const des = getDesc(this, key)!;
            if(des.value)
                acc[key] = des.value;
        }

        return assign(acc, values);
    }

    this.add = (key: string, initial?: any) => {
        values[key] = initial;
        define(this, key, {
            get: () => {
                //TODO register context listeners
                return values[key]
            },
            set: (value) => {
                if(values[key] === value) 
                    return;

                //TODO: Dispatch to context listeners
                values[key] = value;
                this.refresh()
            },
            enumerable: true,
            configurable: true
        })
    }
}

interface Lifecycle {
    willUnmount?: VoidFunction,
    didMount?: VoidFunction
}

function bootstrap(
    update: VoidFunction, 
    source: State, 
    prototype?: BunchOf<Function>){

    let baseLayer = new (LiveStateConstruct as any)(update);
    let methodLayer = create(baseLayer);

    for(const key in source){
        if(key in baseLayer)
            throw new Error(
                `Can't bootstrap ${key} onto live state, it is reserved!`
            )

        const desc = getDesc(source, key)!;
        if(desc.get || desc.set){
            define(methodLayer, key, desc);
            return;
        }

        const { value } = desc;

        if(typeof value === "function"){
            define(methodLayer, key, {
                value: value.bind(methodLayer),
                configurable: true
            })
        }
        else {
            if(key[0] === "_")
                methodLayer[key] = value;
            else
                methodLayer.add(key, value);
        }
    }

    if(prototype){
        const chain = [ prototype ];
        for(let x; x = getProto(prototype); prototype = x){
            if(x === Object.prototype)
                break;
            chain.unshift(x);
        }

        for(const proto of chain.reverse())
        for(const key in proto)
            define(methodLayer, key, getDesc(proto, key)!)
    }

    return methodLayer as State & LiveState;
}

export const use = (() => {

    let cycle: Lifecycle;

    function applyUnmount(u: VoidFunction){
        cycle = { willUnmount: u }
    }

    return function useController(init: any, ...args: any[]){
        let update = useState(0)[1];
        const ref = useRef(null);

        let live = ref.current;

        if(live === null){
            if(!init) throw new Error(
                "useStateful needs some form of intializer."
            )

            let source: any;
            let methods: any;

            if(init.prototype){
                const { constructor: _, willUnmount, didMount, ...prototype } = 
                    init.prototype as Lifecycle;

                methods = prototype;
                cycle = { willUnmount, didMount };
                source = new init(...args);
            }
            else {
                if(typeof init == "function")
                    init = init(applyUnmount);
    
                const { willUnmount, didMount, ...values } = init;
                source = values;
            }

            live = ref.current = bootstrap(update, source, methods);
        }

        useEffect(() => {
            if(cycle.didMount)
                cycle.didMount.call(live);
            return () => {
                if(cycle.willUnmount)
                    cycle.willUnmount.call(live);
                for(const key in live)
                    try { delete live[key] }
                    catch(err) {}
            }
        }, [])
    
        return live;
    }
})()

export { use as useStates }
export { use as useStateful }
 