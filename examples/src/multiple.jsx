import Controller from 'use-stateful';
import React from "react";

export class MultiState extends Controller {
  foo = 0;
  bar = 0;

  fooUp = () => this.foo++ 
  barUp = () => this.bar++ 
};

const useMultiState = MultiState.hook();

export const Multi = () => {
  const Provider = MultiState.create();

  return (
    <Provider>
      <InnerFoo/>
      <InnerBar/>
    </Provider>
  )
}

const InnerFoo = () => {
  const { set, bar } = useMultiState();

  return (
    <div
      className="clicky"
      onClick={set.fooUp}>
      <pre>Foo</pre>
      <small>Bar was clicked {bar} times!</small>
    </div>
  )
}

const InnerBar = () => {
  const { set, foo } = useMultiState();

  return (
    <div
      className="clicky"
      onClick={set.barUp}>
      <pre>Bar</pre> 
      <small>Foo was clicked {foo} times!</small>
    </div>
  )
}