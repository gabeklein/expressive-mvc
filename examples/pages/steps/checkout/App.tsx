import './App.css';

import { Component, has } from '@expressive/mvc';
import { Steps } from '@expressive/steps';

const CART = [
  { name: 'Desk lamp', price: 48 },
  { name: 'Notebook', price: 12 }
];

const TOTAL = CART.reduce((sum, item) => sum + item.price, 0);
const APPROVAL = 15000;

export default () => (
  <div className="container">
    <h1>Checkout</h1>
    <p>
      A <code>Steps</code> model, its methods steps: <code>run</code> reserves the
      cart, <code>reserve</code> schedules <code>pay</code>, and <code>pay</code>{' '}
      parks on <code>this.then(this.approve, this.decline, timeout)</code>. While
      that wait is open, <code>checkout.approve</code> and{' '}
      <code>checkout.decline</code> read as callable steps, so their buttons
      appear and disappear with it. Approving ships and mails the receipt in
      parallel, then ends.
    </p>
    <Storefront />
    <small>
      A decline throws <code>Declined</code>, caught where <code>reserve</code>{' '}
      called <code>this.pay(card).catch(this.declined)</code>: the unwind runs
      the undo <code>pay</code> registered with{' '}
      <code>this.then.undo(this.cancel(authorization))</code> - a step called
      for it, recorded with its args and journaled as it runs - and restores{' '}
      <code>pay</code>'s fields; the hold stays. <code>declined</code> then waits on{' '}
      <code>this.then(this.pay)</code> for another card. Stop cancels and unwinds
      everything. The journal below is <code>checkout.log</code>, filled by the{' '}
      <code>after</code> hook with each step's entry.
    </small>
  </div>
);

class Storefront extends Component {
  checkout = new Checkout();
  card = '4242 4242 4242 4242';

  typed(event: { currentTarget: { value: string } }) {
    this.card = event.currentTarget.value;
  }

  place() {
    this.checkout.run(this.card);
  }

  render() {
    const { checkout, card } = this;
    const { status, active } = checkout.then;
    const { hold, authorization, tracking, receipt, notice, log } = checkout;
    const working = status == 'running' || status == 'waiting';
    const ready = !working;

    return (
      <div className="checkout">
        <ul className="cart">
          {CART.map((item) => (
            <li key={item.name}>
              {item.name} <span>${item.price}</span>
            </li>
          ))}
        </ul>
        <label>
          Card <input value={card} onInput={this.typed} />
        </label>
        <div className="controls">
          {ready && <button onClick={this.place}>Place order</button>}
          {checkout.approve && <button onClick={() => checkout.approve()}>Approve</button>}
          {checkout.decline && <button onClick={() => checkout.decline()}>Decline</button>}
          {checkout.pay && <button onClick={() => checkout.pay(card)}>Try another card</button>}
          {working && <button onClick={() => checkout.then.stop({ undo: true, reason: 'Order cancelled.' })}>Stop</button>}
        </div>
        <p className="status">
          Status: {status}
          {active && <> · {active}</>}
        </p>
        {notice && <p className="notice">{notice}</p>}
        <dl className="fields">
          <dt>Hold</dt>
          <dd>{hold || '-'}</dd>
          <dt>Authorization</dt>
          <dd>{authorization || '-'}</dd>
          <dt>Tracking</dt>
          <dd>{tracking || '-'}</dd>
          <dt>Receipt</dt>
          <dd>{receipt || '-'}</dd>
        </dl>
        <ol className="record">
          {log.map((entry, index) => (
            <li key={index}>
              <code>{entry.id}</code>
              {entry.wrote.length > 0 && <span> wrote {entry.wrote.join(', ')}</span>}
              {entry.unwound && <span className="undone"> undone</span>}
            </li>
          ))}
        </ol>
      </div>
    );
  }
}

class Checkout extends Steps {
  hold = '';
  authorization = '';
  tracking = '';
  receipt = '';
  notice = '';
  log = has<Steps.Entry>();

  async run(card: string) {
    this.tracking = '';
    this.receipt = '';
    this.notice = '';
    this.reserve(card);

    try {
      await this;
    } catch (error) {
      this.notice = (error as Error).message;
      throw error;
    }

    return { tracking: this.tracking, receipt: this.receipt };
  }

  protected async reserve(card: string) {
    const hold = await inventory.hold(this.then.signal);

    this.hold = hold;
    this.then.undo(this.release(hold));
    this.pay(card).catch(this.declined);
  }

  async pay(card: string) {
    const authorization = await bank.authorize(card, TOTAL, this.then.signal);

    this.authorization = authorization;
    this.notice = '';
    this.then.undo(this.cancel(authorization));
    this.then(this.approve, this.decline, async (signal) => {
      await delay(APPROVAL, signal);
      this.decline('timed out');
    });
  }

  async approve() {
    this.then(this.ship(), this.mail());
    this.then.end();
  }

  async decline(reason = 'declined') {
    throw new Declined(`Card ${reason}.`);
  }

  protected async declined(error: unknown) {
    if (!(error instanceof Declined)) throw error;

    this.notice = error.message;
    this.another().catch(this.declined);
  }

  protected async another() {
    this.then(this.pay);
  }

  protected async ship() {
    this.tracking = await courier.book(this.hold, this.then.signal);
  }

  protected async mail() {
    this.receipt = await mailer.send(this.authorization, this.then.signal);
  }

  protected async release(hold: string) {
    await inventory.release(hold);
  }

  protected async cancel(authorization: string) {
    await bank.cancel(authorization);
  }

  protected before(step: string) {
    if (step == 'run') this.log.clear();
  }

  protected after(step: string, entry: Steps.Entry) {
    this.log.push(entry);
  }
}

class Declined extends Error {}

let holds = 0;
let parcels = 0;

const inventory = {
  async hold(signal: AbortSignal) {
    await delay(400, signal);
    return `H-${++holds}`;
  },
  async release(hold: string) {
    void hold;
  }
};

const bank = {
  async authorize(card: string, amount: number, signal: AbortSignal) {
    await delay(600, signal);
    return `A-${card.replace(/\D/g, '').slice(-4)}-$${amount}`;
  },
  async cancel(authorization: string) {
    void authorization;
  }
};

const courier = {
  async book(hold: string, signal: AbortSignal) {
    await delay(800, signal);
    return `T-${hold}-${++parcels}`;
  }
};

const mailer = {
  async send(authorization: string, signal: AbortSignal) {
    await delay(300, signal);
    return `R-${authorization}`;
  }
};

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}
