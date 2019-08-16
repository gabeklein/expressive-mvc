import ReactDOM from "react-dom";
import React from "react";

import { use } from 'use-stateful';

class Whatever {
  value = "Hello World"

  didMount(){
    setTimeout(() => {
      this.value = "Hello You"
    }, 1000)

    setTimeout(() => {
      this.value = "Goodbye cruel world."
    }, 3000)
  }
};

export const Simple = () => {
  const state = use(Whatever);

  return (
    <div
      className="clicky"
      onClick={() => { state.value = "Hello Somebody?"; }}>
      {state.value}
    </div>
  )
};

export const Inline = () => {
  const state = use(class {
    number = 1
  })

  return (
    <div>
      <span 
        className="clicky"
        onClick={() => { state.number -= 1 }}>-</span>
      <span> {state.number} </span>
      <span 
        className="clicky"
        onClick={() => { state.number += 1 }}>+</span>
    </div>
  )
}