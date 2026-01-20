import State from '@expressive/react';

export default class Control extends State {
  agent = 'Bond';
  remaining = 30;
  dead?: boolean = undefined;

  // `this.new` is called hen a model becomes ready to be observed.
  // The method will only be called once and return function
  // will be called on `null` event, when model is destroyed.
  new() {
    const done = () => clearInterval(timer);
    const timer = setInterval(() => {
      const remains = this.remaining--;

      if (remains === 0) {
        this.dead = Math.random() > 0.5;
        done();
      }
    }, 1000);

    return done;
  }

  async getNewAgent() {
    const res = await fetch('https://randomuser.me/api?nat=gb&results=1');
    const data = await res.json();
    const recruit = data.results[0];

    this.agent = recruit.name.last;
  }
}
