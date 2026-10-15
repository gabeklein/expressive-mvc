import './App.css';

import Button from '@common/Button';
import { Component, set } from '@expressive/mvc';

export default () => (
  <div className="container">
    <h1>Await an Effect</h1>
    <p>
      The function an effect returns can also be awaited: it stops the effect
      and yields the latest value. <code>send()</code> awaits a projection of{' '}
      <code>link</code> - before the link exists the await waits for it, after
      that it resolves at once. No ready flag, no suspense boundary.
    </p>
    <Invite />
    <small>
      Only an async effect yields a value. A sync effect's return stays a
      cleanup, so awaiting one resolves <code>undefined</code>.
    </small>
  </div>
);

class Invite extends Component {
  // No value until assigned - reading `link` before then suspends.
  link = set<string>();
  status = 'Not sent';

  protected new() {
    const timer = setTimeout(() => {
      this.link = 'https://expressive.dev/join/7f3a';
    }, 2000);

    return () => clearTimeout(timer);
  }

  async send() {
    this.status = 'Waiting for the link…';

    const link = await this.get(async ($) => $.link);

    this.status = `Sent ${link}`;
  }

  render() {
    return (
      <>
        <Button primary onClick={this.send}>
          Send invite
        </Button>
        <p className="result">{this.status}</p>
      </>
    );
  }
}
