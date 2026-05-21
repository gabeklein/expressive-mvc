import { Component, get } from '@expressive/react';

import { Route } from './route';

export class Redirect extends Component {
  to = '';
  replace = false;
  when: boolean = true;

  private route = get(Route);
  private fired = false;

  render() {
    if (!this.fired && this.when) {
      this.fired = true;
      this.route.goto(this.to, this.replace);
    }
    return null;
  }
}
