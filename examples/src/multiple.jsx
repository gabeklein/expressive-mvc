import Controller from 'react-use-controller';
import React, { useState } from "react";

export class Central extends Controller {
  foo = 0;
  bar = 0;

  fooUp = () => this.foo++ 
  barUp = () => this.bar++ 
};

export default () => {
  const [ value, setValue ] = useState("Foo");

  return (
    <div>
      <div onClick={() => setValue("Bar")}>
        Hello {value}
      </div>

      <Central.Provider value={value}>
        <InnerFoo/>
        <InnerBar/>
      </Central.Provider>
    </div>
  )
}

const InnerFoo = () => {
  const { fooUp, bar, value } = Central.get();

  return (
    <div className="clicky" onClick={fooUp}>
      <pre>Foo</pre>
      <small>Bar was clicked {bar} times!</small><br/>
      <small>Oh and value prop is {value}</small>
    </div>
  )
}

const InnerBar = () => {
  const { barUp, foo, value } = Central.get();

  return (
    <div
      className="clicky"
      onClick={barUp}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small><br/>
      <small>Oh and value prop is {value}</small>
    </div>
  )
}