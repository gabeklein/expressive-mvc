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