import Controller from 'use-stateful';
import React from "react";

export class FooBar extends Controller {
  foo = 0;
  bar = 0;

  fooUp = () => this.foo++ 
  barUp = () => this.bar++ 
};

export const Multi = () => {
  const Control = FooBar.create();

  return (
    <Control>
      <InnerFoo/>
      <InnerBar/>
    </Control>
  )
}

const InnerFoo = () => {
  const { fooUp, bar } = FooBar.get();

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
  const { barUp, foo } = FooBar.get();

  return (
    <div
      className="clicky"
      onClick={barUp}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small>
    </div>
  )
}