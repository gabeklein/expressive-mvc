import ReactDOM from "react-dom";
import React, { useEffect, useRef } from "react";

import { hot } from "react-hot-loader/root";
import { sleep } from "good-timing";

import { use } from 'use-stateful';

class Whatever {
  value = "Hello World"

  constructor(){
    setTimeout(() => {
      this.value = "Hello You"
    }, 1000)


    setTimeout(() => {
      this.value = "Goodbye cruel world."
    }, 3000)
  }
};

const App = () => {
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

ReactDOM.render(
  <App />, 
  document.getElementById("root")
);