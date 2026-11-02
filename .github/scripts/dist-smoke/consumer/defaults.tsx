/** @jsxRuntime classic */
import * as React from '@expressive/dom';
import { Component } from '@expressive/mvc';

class Card extends Component {
  title = '';

  render() {
    return <b>{this.title}</b>;
  }
}

export const defaults = (
  <>
    <Card title="t" />
    {/* @ts-expect-error */}
    <Card title={1} />
  </>
);

void React;
