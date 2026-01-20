import Control from './Control';

const Situation = () => {
  const { agent, dead, getNewAgent, remaining } = Control.use();

  if (dead === true) {
    return <h2>🙀💥 Unforunately, the cat exploded.</h2>;
  }

  if (dead === false) {
    return <h2>😸👍 Oh, the cat did not explode.</h2>;
  }

  return (
    <div className="timer">
      <h1 className="box">📦</h1>
      <p>
        <b>Agent {agent}</b>, we need you to diffuse the bomb!
      </p>
      <p>
        If you can't do it in {remaining} seconds, Schrödinger's cat may or may
        not die!
      </p>
      <p>
        But there's still time!
        <button onClick={getNewAgent}>Tap another agent</button>
        if you think they can do it.
      </p>
    </div>
  );
};

export default Situation;
