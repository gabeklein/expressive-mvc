const UID_CACHE = new WeakMap();

export function assignWeak(into: any, from: any){
  for(const K in from)
    if(K in into)
      into[K] = from[K];
}

export function uid(object: {}){
  let uid = UID_CACHE.get(object);

  if(!uid)
    UID_CACHE.set(object, uid = Math.random());

  return uid;
}