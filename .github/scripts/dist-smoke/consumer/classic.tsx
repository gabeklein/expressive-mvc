/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { Component } from '@expressive/mvc';
import { Fragment, createElement } from '@expressive/dom';

class Card extends Component {
  title = '';

  render() {
    return <b>{this.title}</b>;
  }
}

export const classic = (
  <>
    <div className="x">
      <Card title="t" />
    </div>
    {/* @ts-expect-error */}
    <Card title={1} />
  </>
);
