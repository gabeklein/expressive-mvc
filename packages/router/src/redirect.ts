import { Component, get } from '@expressive/mvc';

import { Route } from './route';

/**
 * Navigate to `to` on activation; renders nothing.
 *
 * Resolves `to` against the nearest Route. Pushes history unless `replace`.
 */
export class Redirect extends Component {
  to = '';
  replace = false;
  /** Navigate only when true. Default true. */
  when: boolean = true;
  fallback = false;

  private route = get(Route);

  protected new() {
    if (this.when) this.route.goto(this.to, this.replace);
  }

  render() {
    return null;
  }
}
