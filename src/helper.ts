export function invokeLifecycle(
  target: any,
  didMount?: VoidFunction, 
  willUnmount?: VoidFunction){

  if(didMount)
    didMount.call(target);
  return () => {
    if(willUnmount)
      willUnmount.call(target);
    for(const key in target)
      try { delete target[key] }
      catch(err) {}
  }
}