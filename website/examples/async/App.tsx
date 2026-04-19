import { Control } from './Control';

const App = () => {
  // Control is a State, separating concerns of this component.
  // This focuses on presentation, while Control focuses on behavior.
  const { agent, dead, getNewAgent, remaining } = Control.use();

  if (dead === true)
    return <h2>🙀💥 Unfortunately, the cat exploded.</h2>;

  if (dead === false)
    return <h2>😸👍 Oh, the cat did not explode.</h2>;

  return (
    <div className="container">
      <h1>Async Example</h1>
      <div className="timer">
        <h1 className="box">📦</h1>
        <p>
          <b>Agent {agent}</b>, we need you to defuse the bomb!
        </p>
        <p>
          If you can't do it in {remaining} seconds, Schrödinger's cat may or
          may not die!
        </p>
        <p>
          But there's still time!
          <button onClick={getNewAgent}>Tap another agent</button>
          if you think they can do it.
        </p>
      </div>
    </div>
  );
};

export default App;
