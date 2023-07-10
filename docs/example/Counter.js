import { Model } from "@expressive/react";

class Counter extends Model {
  current = 1;

  increment = () => this.current++;
  decrement = () => this.current--;
}

const Example = () => {
  const { current, increment, decrement } = Counter.use();

  div: {
    userSelect: none;
    WebkitUserSelect: none;
    fontSize: 50;
    display: flex;
    alignItems: center;
    justifyContent: center;
  }
  
  pre: {
    padding: 0, 20;
    minWidth: 60;
    textAlign: center;
  }
  
  button: {
    fontSize: 30;
    width: 50;
    height: 50;
    display: block;
    background: $shikiTokenComment;
    border: 0xeee;
    borderRadius: 99;
    verticalAlign: middle;
    color: $shikiColorAnsiBrightWhite;
  }

  <div>
    <button onClick={decrement}>{"-"}</button>
    <pre>{current}</pre>
    <button onClick={increment}>{"+"}</button>
  </div>
};

export default Example;