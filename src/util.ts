const { 
  entries,
  defineProperty,
  getOwnPropertyDescriptors,
  getPrototypeOf
} = Object;

export class Set<T> extends Array<T> {
  add = (item: T) => {
    if(this.indexOf(item) < 0)
      this.push(item);
  };

  clear = () => {
    this.splice(0, this.length);
  };

  delete = (item: T) => {
    const i = this.indexOf(item);
    if(i >= 0)
      this.splice(i, 1);
  }

  get size(){
    return this.length;
  }
}

export class Map<K, V> extends Array<[K, V]> {
  get = (key: K) => {
    for(const [ _key, value ] of this)
      if(key === _key)
        return value as V;
  }

  set = (key: K, value: V) => {
    for(let i=0, l=this.length; i < l; i++)
      if(this[i][0] === key){
        this[i][1] = value;
        return;
      }
    
    this.push([key, value]);
    return;
  }
}

export function define(target: {}, values: {}): void;
export function define(target: {}, key: string, value: any): void;
export function define(target: {}, kv: {} | string, v?: {}){
  if(typeof kv == "string")
    defineProperty(target, kv, { value: v })
  else
    for(const [key, value] of entries(kv))
      defineProperty(target, key, { value });
}

export function dedent(t: TemplateStringsArray, ...v: any[]): string {
  const text = v.reduce((a, v, i) => a + v + t[i + 1], t[0]);
  const starting = /^\n( *)/.exec(text);
  
  if(starting){
    const indent = new RegExp("\n" + starting[1], "g");
    return text.replace(starting[0], "").replace(indent, "\n").replace(/\s*\n*$/, "")
  } 
  else return text;
}

export function constructorOf(obj: any){
  if(obj.prototype)
    return obj.prototype.constructor;

  while(obj){
    obj = getPrototypeOf(obj);
    if(obj.constructor)
      return obj.constructor;
  }
}

export function defineOnAccess(
  object: any, property: string, init: () => any){

  Object.defineProperty(object, property, { 
    configurable: true,
    get: function(){
      const value = init.call(this);
      Object.defineProperty(this, property, { value });
      return value;
    }
  });
}

export function entriesOf(obj: {}){
  return entries(getOwnPropertyDescriptors(obj));
}