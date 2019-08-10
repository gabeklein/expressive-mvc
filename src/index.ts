import { useState, useEffect, useRef } from 'react';

const { random } = Math;
const { 
    defineProperty: define, 
    getOwnPropertyDescriptor: getDesc, 
    getPrototypeOf: getProto,
    assign
} = Object;

type BunchOf<T> = { [key: string]: any }

type State = LiveState & BunchOf<any>

interface LiveState<State = any> {
    refresh(): void;
    add(key: string, initial?: any): void;
    export(): State;
}

function ConnectLiveState(
    to: LiveState,
    updateHook: (beat: number) => void
){
    function apply(method: string, value: Function){
        if((to as any)[method])
            throw `Can't bootstrap ${method} onto live state, it is reserved!`
        else 
            define(to, method, { value })
    }
    
    const values = {} as BunchOf<any>;
    let pending = false;

    apply("refresh", function(){
        if(pending)
            return
        pending = true;
        setTimeout(() => {
            updateHook(random());
            pending = false;
        }, 0)      
    })

    apply("export", function(
        this: any){

        const acc = {} as BunchOf<any>;
        for(const key in this){
            const des = getDesc(this, key)!;
            if(des.value)
                acc[key] = des.value;
        }

        return assign(acc, values);
    })

    apply("add", function(
        this: any, 
        key: string, 
        initial?: any){

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
                to.refresh()
            },
            enumerable: true,
            configurable: true
        })
    })
}

interface Lifecycle {
    willUnmount?: VoidFunction,
    didMount?: VoidFunction
}

function bootstrap(
    init: any,
    args: any[],
    applyUnmount: (lc: Lifecycle) => void,
    update: (x: any) => void
){

    let baseLayer: any;
    let methods: any;

    if(init.prototype){
        let { constructor: _, willUnmount, didMount, ...prototype } = 
            init.prototype as Lifecycle;

        methods = prototype;
        init = new init(...args);
        
        const { willUnmount: will, didMount: did } = init;

        if(will){ willUnmount = will; delete init.willUnmount }
        if(did){ didMount = did; delete init.didMount }

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

    ConnectLiveState(baseLayer, update);

    for(const key in baseLayer){
        const desc = getDesc(baseLayer, key)!;
        if(desc.get || desc.set){
            define(baseLayer, key, desc);
            return;
        }

        const { value } = desc;

        if(typeof value === "function"){
            define(baseLayer, key, {
                value: value.bind(baseLayer),
                configurable: true
            })
        }
        else if(key[0] !== "_")
            baseLayer.add(key, value);
    }

    if(methods){
        const chain = [ methods ];
        for(let x; x = getProto(methods); methods = x){
            if(x === Object.prototype)
                break;
            chain.unshift(x);
        }

        for(const proto of chain.reverse())
        for(const key in proto)
            define(baseLayer, key, getDesc(proto, key)!)
    }

    return baseLayer as State & LiveState;
}

const use = (() => {

    let cycle = {} as Lifecycle;

    function onLifecycle(lc: Lifecycle){ cycle = lc }

    return function useController(init: any, ...args: any[]){
        const update = useState(0);
        const ref = useRef(null);

        let live = ref.current;

        if(live === null){
            if(!init) throw new Error(
                "useStateful needs some form of intializer."
            )
            live = ref.current = 
                bootstrap(init, args, onLifecycle, update[1])
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

export { 
    use,
    use as useStates,
    use as useStateful,
    use as useController
}
 