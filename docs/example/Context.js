import Model, { Provider } from '@expressive/react';

class State extends Model {
  foo = 0;
  bar = 0;
}

const ContextExample = () => {
  // background: 0x1E2428;
  background: "hsl(var(--nextra-primary-hue)100% 39%/.05)";
  radius: 10;
  height: 200;
  position: relative;

  container: {
    // outline: blue;
    padding: 20;
    border: blue;
    display: flex;
    justifyContent: space-around;
    alignItems: center;
    absolute: fill;
    top: 20;
    bottom: 20;
    left: 22;
    right: 22;
  }

  <Provider for={State}>
    <container>
      <Foo />
      <Bar />
    </container>
  </Provider>
}

export default ContextExample;

const ClickItem = ({ children, ...props }) => {
  border: currentColor, px(1), solid;
  // color: 0xddd;
  fontSize: 24;
  fontFamily: monospace;
  padding: 10, 24;
  background: 0xfff1
  userSelect: none;
  cursor: pointer;
  radius: 10;
  textAlign: center;
  transition: "all .1s ease-in-out";

  css: active: {
    transform: "scale(.96)";
  }

  <this {...props}>
    <p>{children}</p>
  </this>
}

const Foo = () => {
  const { is: state, foo } = State.get();

  small: {
    fontSize: 15;
    display: block;
  }

  <ClickItem onClick={() => state.bar += 1}>
    Foo: {foo}
    <small>
      Click increments bar
    </small>
  </ClickItem>
}

const Bar = () => {
  const { is: state, bar } = State.get();

  small: {
    fontSize: 15;
    display: block;
  }

  <ClickItem onClick={() => state.foo += 1}>
    Bar: {bar}
    <small>
      Click increments foo
    </small>
  </ClickItem>
}