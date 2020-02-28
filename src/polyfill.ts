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

export function constructorOf(obj: any){
  if(obj.prototype)
    return obj.prototype.constructor;

  while(obj){
    obj = Object.getPrototypeOf(obj);
    if(obj.constructor)
      return obj.constructor;
  }
}

export function defineInitializer(
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