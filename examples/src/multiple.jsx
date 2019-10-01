import Controller from 'react-use-controller';
import React from "react";

export class Central extends Controller {
  foo = 0;
  bar = 0;

  fooUp = () => this.foo++ 
  barUp = () => this.bar++ 
};

export const Multi = () => {
  const Control = Central.create();

  return (
    <Control>
      <InnerFoo/>
      <InnerBar/>
    </Control>
  )
}

const InnerFoo = () => {
  const { fooUp, bar } = Central.get();

  return (
    <div
      className="clicky"
      onClick={fooUp}>
      <pre>Foo</pre>
      <small>Bar was clicked {bar} times!</small>
    </div>
  )
}

const InnerBar = () => {
  const { barUp, foo } = Central.get();

  return (
    <div
      className="clicky"
      onClick={barUp}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small>
    </div>
  )
}