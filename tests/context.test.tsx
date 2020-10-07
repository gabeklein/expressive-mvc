import React from "react";
import { create } from "react-test-renderer";

import { Controller, Provider } from "./adapter";

type Model = typeof Controller;
type AccessProps<T extends Model> = {
  of: T; 
  get: { 
    [P in keyof InstanceType<T>]?: jest.Mock 
  }
}

class Simple extends Controller {
  value = "foo";
}

function Consumer<T extends Model>(
  { of: Subject, get }: AccessProps<T>){

  const instance = Subject.get();

  for(const key in get)
    get[key](instance[key]);

  return null;
}

describe("Provider", () => {
  it("should create an instance of parent controller", () => {
    const value = jest.fn();

    create(
      <Simple.Provider>
        <Consumer of={Simple} get={{ value }}/>
      </Simple.Provider>
    );

    expect(value).toBeCalledWith("foo");
  })

  it("should provide existing instance of controller", () => {
    function Parent({ children }: any){
      const { Provider } = Simple.use();
      return <Provider>{children}</Provider>;
    }

    const value = jest.fn();

    create(
      <Parent>
        <Consumer of={Simple} get={{ value }}/>
      </Parent>
    );

    expect(value).toBeCalledWith("foo");
  })

  it("should create instance from MultiProvider", () => {
    const value = jest.fn();
    
    create(
      <Provider of={[ Simple ]}>
        <Consumer of={Simple} get={{ value }}/>
      </Provider>
    )

    expect(value).toBeCalledWith("foo");
  })
})