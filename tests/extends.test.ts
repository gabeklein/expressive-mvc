import { renderHook, HookResult, act } from "@testing-library/react-hooks";
import { ProviderExoticComponent } from "react";
import Controller from "../";

type Accessor = 
  "use" | "useOn" | "useExcept" | "useOnly" | "useOnce" |
  "get" | "getOn" | "getExcept" | "getOnly" | "getOnce" ;

function callControllerMethod(named: Accessor, ...args: any[]): HookResult<TestController>
function callControllerMethod(named: "create"): HookResult<ProviderExoticComponent<TestController>>

function callControllerMethod(named: string, ...args: any[]){
  const exec = () => (<any>TestController)[named](...args)
  const { result } = renderHook(exec);
  return result;
}

class TestController extends Controller {

  init?: string;

  constructor(init: string | undefined){
    super();
    this.init = init;
  }

  value = 1;
  value2 = 2;

  willHook(){
    console.log("hi")
  }

  setValueToThree = () => this.value = 3;
}

test('initializes from `extends Controller`', () => {
  const result = callControllerMethod("use")

  expect(result.current.value).toBe(1);
  expect(result.current.value2).toBe(2);
})

test('passes arguments to constructor', () => {
  const result = callControllerMethod("use", "Hello World!")

  expect(result.current.init).toBe("Hello World!");
})