// import { Control, Observer, observer } from '../control';
// import { assign, create, defineProperty } from '../helper/object';
// import { add } from './add';

// type MapFunction<T, R> =
//   T extends Map<infer K, infer V> ?
//     (value: V, key: K, map: T) => R | void :
//   never;

// type Managed<T> = Exclude<T, "forEach"> & {
//   from?: T;

//   forEach<R>(
//     mapFunction: MapFunction<T, R>,
//     thisArg?: T
//   ): Exclude<R, undefined>[] | void;
// }

// const ANY = Symbol("any");

// type Keyed<K = unknown> = Map<K, unknown>;

// function map <K, V = any> (initial?: Map<K, V>): Managed<Map<K, V>>;
// function map <K, V = any> (from: () => Map<K, V>): Managed<Map<K, V>>;

// function map <T extends Map<any, any>> (initial: T): Managed<T>;
// function map <T extends Map<any, any>> (from: () => T): Managed<T>;

// function map(input: any){
//   return add(
//     function map(key){
//       if(!input)
//         input = new Map();

//       if(typeof input === "function"
//       && "prototype" in input
//       && input === input.prototype.constructor)
//         input = new input();

//       return keyed(this, key, input);
//     }
//   )
// }

// export { map }

// function keyed<T extends Keyed>(
//   control: Control,
//   property: any,
//   initial: T
// ): Control.PropertyDescriptor<T> {
//   type K = typeof ANY | (
//     T extends Set<infer U> ? U :
//     T extends Map<infer U, any> ? U :
//     never
//   );

//   const init = createProxy(emit, watch);
//   const frozen = new Set<Observer>();
//   const context = new Map<Observer, T>();
//   const users = new Map<Observer, Set<K>>();
//   const watched = new WeakMap<T, Set<K>>();
//   const update = new Set<(key: K) => void>();

//   let managed: T = init(initial);

//   function watch(on: any, key: K){
//     const include = watched.get(on);

//     if(include)
//       include.add(key);
//   }

//   function emit(key: K){
//     control.update(property);
//     control.waiting.add(() => frozen.clear());
//     update.forEach(notify => notify(key));
//   }

//   function subscribe(local: Observer){
//     const proxy = create(managed);
//     let watch = users.get(local);

//     if(!watch){
//       const using = watch = new Set<K>();
//       users.set(local, using);
  
//       function onEvent(key: K){
//         if(frozen.has(local))
//           return;
  
//         if(key === ANY || using.has(key) || using.has(ANY)){
//           const refresh = local(property, control);
  
//           if(typeof refresh == 'function'){
//             frozen.add(local);
//             refresh()
//           }
//         }
//       }
  
//       local.follow(property, false);
//       local.dependant.add({
//         commit(){
//           if(using.size === 0)
//             using.add(ANY);
  
//           update.add(onEvent);
//         },
//         release(){
//           update.delete(onEvent);
//         }
//       })
//     }

//     watched.set(proxy, watch);
//     context.set(local, proxy);

//     return proxy;
//   }

//   control.addListener(key => {
//     if(key === null){
//       update.clear();
//       context.clear();
//     }
//   })

//   return {
//     value: initial,
//     get(source){
//       const local = observer(source);

//       return local ?
//         context.get(local) || subscribe(local) :
//         managed;
//     },
//     set(next){
//       control.state[property] = next;
//       managed = init(next);
//       context.clear();
//       emit(ANY);
//     }
//   }
// }

// function createProxy(
//   emit: (key: any) => void,
//   watch: (self: any, key: any) => void){

//   return <T extends Map<any, any>>(from: T) => {
//     const proxy = create(from) as T;

//     assign(proxy,
//       {
//         from,
//         delete(key: any){
//           // TODO: this commit's fix needs tests.
//           // Was not cause by coverage.
//           const out = from.delete(key);
//           emit(key);
//           return out;
//         },
//         clear(){
//           from.clear();
//           emit(ANY);
//         },
//         get(key: any){
//           watch(this, ANY);
//           return from.get(key);
//         },
//         set(key: any, value: any){
//           from.set(key, value);
//           emit(key);
//           return this;
//         },
//         has(key: any){
//           watch(this, key);
//           return from.has(key);
//         },
//         keys(){
//           watch(this, ANY);
//           return from.keys();
//         },
//         values(){
//           watch(this, ANY);
//           return from.values();
//         },
//         entries(){
//           watch(this, ANY);
//           return from.entries();
//         },
//         forEach(
//           callbackfn: (a: any, b: any, c: any) => any,
//           thisArg: any){

//           const acc = [] as any[];

//           from.forEach((a, b, c) => {
//             const result = callbackfn.call(thisArg, a, b, c);

//             if(result !== undefined)
//               acc.push(result);
//           });

//           watch(this, ANY);

//           return acc;
//         },
//         [Symbol.iterator](){
//           watch(this, ANY);
//           return from[Symbol.iterator]();
//         },
//       })

//       defineProperty(proxy, "size", {
//         get(){
//           watch(this, ANY);
//           return from.size;
//         }
//       })
    
//     return proxy;
//   }
// }

// export { keyed, Managed };