import State from '@expressive/react';

export class Control extends State {
  // Properties set starting values; assignments dispatch updates.
  agent = 'Bond';
  remaining = 30;
  dead?: boolean = undefined;

  // new() runs once when ready. The returned function runs on
  // teardown - handy for clearing timers or subscriptions.
  protected new() {
    const timer = setInterval(() => {
      if (--this.remaining > 0) return;

      this.dead = Math.random() > 0.5;
      clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }

  // Async methods assign to `this` - no thunks needed.
  async getNewAgent() {
    const res = await fetch('https://randomuser.me/api?nat=gb&results=1');
    const data = await res.json();

    this.agent = data.results[0].name.last;
  }
}
