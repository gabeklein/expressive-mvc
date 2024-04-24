import Model from '@expressive/react';

export default class Control extends Model {
  agent = "Bond";
  remaining = 30;
  dead?: boolean = undefined;

  constructor(...args: Model.Args) {
    // Functions passed to constructor are called
    // when a model becomes ready to be observed.
    // The function will only be called once and return function
    // will be called on `null` event, when model is destroyed.
    super(...args, () => {
      const done = () => clearInterval(timer);
      const timer = setInterval(() => {
        const remains = this.remaining--;
  
        if (remains === 0) {
          this.dead = Math.random() > 0.5;
          done();
        }
      }, 1000);
  
      return done;
    });
  }

  getNewAgent = async () => {
    const res = await fetch("https://randomuser.me/api?nat=gb&results=1");
    const data = await res.json();
    const recruit = data.results[0];

    this.agent = recruit.name.last;
  };
}
