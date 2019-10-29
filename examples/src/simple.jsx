import ReactDOM from "react-dom";
import React from "react";

import { use } from 'react-use-controller';

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

class EmotionalState {
  name = "John Doe"
  emotion = "meh"
  reason = "reasons..."
}

export const Destructured = () => {
  const {
    set, // ⬅ proxy value for full state
    name,
    emotion,
    reason
  } = use(EmotionalState);

  return (
    <div>
      <div onClick = {() => {
        set.name = prompt("What is your name?", "John Doe");
      }}>
        My name is {name}.
      </div>
      <div>
        <span onClick = {() => {
          set.emotion = "doing better"
        }}>
          I am currently {emotion} 
        </span>
        <span onClick = {() => {
          set.reason = "hooks are cooler than my cold-brew® coffee! 👓"
        }}>
          , because {reason}
        </span>
      </div>
    </div>
  )
}