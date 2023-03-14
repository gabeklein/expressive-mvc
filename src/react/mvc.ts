import { FindInstruction, Model } from '../model';
import { getContextForGetInstruction } from './get';
import { useContext } from './useContext';
import { useModel } from './useModel';
import { useTap } from './useTap';

export { Model };

FindInstruction.set(Model, getContextForGetInstruction);

Object.assign(Model, <any>{
  use(arg1: any, arg2?: any){
    return useModel(this, arg1, arg2);
  },
  get(required?: boolean){
    return useContext(this, required);
  },
  tap(arg1?: any, arg2?: boolean): any {
    return useTap(this, arg1, arg2);
  },
  meta(arg1?: any, arg2?: any){
    return useTap(() => this, arg1, arg2);
  }
})