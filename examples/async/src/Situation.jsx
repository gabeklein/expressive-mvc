import Model from "@expressive/react";

class Control extends Model {
  agent = "Bond";
  remaining = 60;
  dead = undefined;

  constructor() {
    super();

    // the `get` method will be called when a model
    // becomes ready to be observed. Assuming no properties
    // are accessed from subscriber (first parameter), the
    // function will only be called once and return function
    // will be called on `null` event (model is destoryed).
    this.get(this.missionStart, []);
  }

  missionStart() {
    const tickTock = () => {
      const remains = this.remaining--;

      if(remains === 0){
        this.dead = Math.random() > 0.5;
        clear();
      }
    };

    const timer = setInterval(tickTock, 1000);
    const clear = () => clearInterval(timer);

    return clear;
  }

  getSomebodyElse = async () => {
    const res = await fetch("https://randomuser.me/api/");
    const data = await res.json();
    const recruit = data.results[0];

    this.agent = recruit.name.last;
  };
}

const Situation = () => {
  const { agent, dead, getSomebodyElse, remaining } = Control.use();

  if(dead !== undefined)
    return dead
      ? <h2>🙀💥 Unforunately, the cat exploded.</h2>
      : <h2>😸👍 Oh, the cat did not explode.</h2>

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
        <button onClick={getSomebodyElse}>Tap another agent</button>
        if you think they can do it.
      </p>
    </div>
  );
};

export default Situation;