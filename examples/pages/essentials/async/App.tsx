import './App.css';

import { Component } from '@expressive/mvc';

import { Control } from './Control';

// Control is a Model, separating concerns of this page.
// Component provides an instance; Bomb focuses on presentation.
const App = () => (
  <Component for={Control}>
    <Bomb />
  </Component>
);

const Bomb = () => {
  const { agent, dead, getNewAgent, remaining } = Control.get();

  if (dead === true)
    return (
      <div className="container">
        <div className="emoji">🙀💥</div>
        <h2>Unfortunately, the cat exploded.</h2>
      </div>
    );

  if (dead === false)
    return (
      <div className="container">
        <div className="emoji">😸👍</div>
        <h2>Oh, the cat did not explode.</h2>
      </div>
    );

  return (
    <div className="container">
      <h1>Async Example</h1>
      <div className="timer">
        <h1 className="box">📦</h1>
        <p>
          <b>Agent {agent}</b>, we need you to defuse the bomb!
        </p>
        <p>
          If you can't do it in <span className='seconds'>{remaining}</span> seconds, Schrödinger's cat may or
          may not die. But there's still time!
        </p>
        <p>
          <button onClick={getNewAgent}>Tap another agent</button>
          if you think they can do it.
        </p>
      </div>
    </div>
  );
};

export default App;
