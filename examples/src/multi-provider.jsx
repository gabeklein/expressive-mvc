import Controller, { Provide } from 'react-use-controller';
import React, { useState } from "react";

export class Central extends Controller {
  foo = 0;
  bar = 0;

  fooUp = () => this.foo++ 
  barUp = () => this.bar++ 

  elementDidMount(){
    // debugger
  }
};

export default () => {
  const [ value, setValue ] = useState("Foo");

  return (
    <div>
      <div onClick={() => setValue("Bar")}>
        Hello {value}
      </div>

      <Provide using={[ Central ]} value={value}>
        <InnerFoo/>
        <InnerBar/>
      </Provide>
    </div>
  )
}

const InnerFoo = () => {
  const { fooUp, bar, value } = Central.watch();

  return (
    <div className="clicky" onClick={fooUp}>
      <pre>Foo</pre>
      <small>Bar was clicked {bar} times!</small><br/>
      <small>Oh and value prop is {value || "nothing"}</small>
    </div>
  )
}

const InnerBar = () => {
  const { barUp, foo, value } = Central.watch();

  return (
    <div
      className="clicky"
      onClick={barUp}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small><br/>
      <small>Oh and value prop is {value || "nothing"}</small>
    </div>
  )
}