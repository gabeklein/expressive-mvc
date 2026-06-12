import { Component, get } from '@expressive/mvc';

import { Route } from './route';

export class Redirect extends Component {
  to = '';
  replace = false;
  when: boolean = true;

  private route = get(Route);

  protected new() {
    if (this.when) this.route.goto(this.to, this.replace);
  }

  render() {
    return null;
  }
}
