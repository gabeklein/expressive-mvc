import State from '@expressive/react';

export class Control extends State {
  // Properties both set starting values and track updates.
  // Anything with a reference to instance has source of truth
  // and an ability to dispatch updates - just assign values.
  agent = 'Bond';
  remaining = 30;
  dead?: boolean = undefined;

  // new() runs once when the instance becomes ready.
  // The function it returns runs on teardown - good for
  // cleaning up side effects like timers or subscriptions.
  protected new() {
    const timer = setInterval(() => {
      if (--this.remaining > 0) return;

      this.dead = Math.random() > 0.5;
      clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }

  // Simple async methods can control state.
  // No thunks or actions necessary - just code.
  async getNewAgent() {
    const res = await fetch('https://randomuser.me/api?nat=gb&results=1');
    const data = await res.json();

    this.agent = data.results[0].name.last;
  }
}
