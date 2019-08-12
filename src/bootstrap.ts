import { BunchOf, LiveState } from './types.d';

const { random } = Math;
const { 
    defineProperty: define, 
    getOwnPropertyDescriptor: getDesc, 
    assign
} = Object;

export function bootstrapForIn(
  target: LiveState, 
  prototype?: any, 
  Root?: any){
  for(const key in target){
      const d = getDesc(target, key)!;

      if(d.get || d.set || typeof d.value === "function")
        continue

      if(key[0] !== "_")
        target.add(key, d.value);
  }
}

export function applyLiveState(
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