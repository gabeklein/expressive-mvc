import './App.css';

import { Component, ref } from '@expressive/react';

// The `ref` instruction is the useRef replacement: a slot for a value
// outside the render data - here a DOM node. Pass it straight to `ref=`
// (it's callable) and read `.current` to reach the element imperatively.
class Field extends Component {
  input = ref<HTMLInputElement>();

  focus() {
    this.input.current?.focus();
  }

  render() {
    return (
      <div className="container">
        <h1>Refs</h1>
        <input ref={this.input} placeholder="Press the button to focus me" />
        <button onClick={this.focus}>Focus the input</button>
      </div>
    );
  }
}

export default () => <Field />;
