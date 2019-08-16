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
      style={{
        fontSize: 70
      }}
      onClick={() => {
        state.value = "Hello Somebody?";
      }}>
      {state.value}
    </div>
  )
};

export const Inline = () => {
  const state = use(class {
    number = 1
  })

  return (
    <div
    style={{
      fontSize: 70
    }}>
      <span onClick={() => { 
        state.number -= 1
      }}>-</span>
      <span> {state.number} </span>
      <span onClick={() => { 
        state.number += 1
      }}>+</span>
    </div>
  )
}