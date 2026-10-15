import './App.css';

import { Component } from '@expressive/mvc';
import { Job } from '@expressive/run';

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
      A <code>Job</code> whose methods are steps: <code>next</code> reserves the
      cart, <code>reserve</code> schedules <code>pay</code>, and <code>pay</code>{' '}
      parks on <code>this.then(this.approve, this.decline, timeout)</code>. While
      that wait is open, <code>checkout.approve</code> and{' '}
      <code>checkout.decline</code> read as callable steps, so their buttons
      appear and disappear with it. Approving ships and mails the receipt in
      parallel, then ends.
    </p>
    <Storefront />
    <small>
      A decline calls <code>this.then.back(this.reserve)</code> - the
      authorization is cancelled by the undo <code>pay</code> returned and its
      fields restored by <code>rewind</code>, the hold stays - then waits on{' '}
      <code>this.then(this.pay)</code> for another card. Stop cancels and unwinds
      everything. The journal below is <code>checkout.then.record</code>.
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
    this.checkout.next(this.card);
  }

  render() {
    const { checkout, card } = this;
    const { status, active, record } = checkout.then;
    const { hold, authorization, tracking, receipt, notice } = checkout;
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
          {working && <button onClick={() => checkout.then.stop(true, 'Order cancelled.')}>Stop</button>}
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
          {record.map((entry, index) => (
            <li key={index}>
              <code>{entry.id}</code>
              {entry.wrote.length > 0 && <span> wrote {entry.wrote.join(', ')}</span>}
              {entry.undone && <span className="undone"> undone</span>}
            </li>
          ))}
        </ol>
      </div>
    );
  }
}

class Checkout extends Job {
  static readonly rewind = true;

  hold = '';
  authorization = '';
  tracking = '';
  receipt = '';
  notice = '';

  async next(card: string) {
    this.tracking = '';
    this.receipt = '';
    this.notice = '';
    this.reserve(card);
  }

  protected async reserve(card: string) {
    const hold = await inventory.hold(this.then.signal);

    this.hold = hold;
    this.pay(card);

    return this.release(hold);
  }

  async pay(card: string) {
    const authorization = await bank.authorize(card, TOTAL, this.then.signal);

    this.authorization = authorization;
    this.notice = '';
    this.then(this.approve, this.decline, async (signal) => {
      await delay(APPROVAL, signal);
      this.decline('timed out');
    });

    return this.cancel(authorization);
  }

  async approve() {
    this.then(this.ship(), this.mail());
    this.end();
  }

  async decline(reason = 'declined') {
    this.then.back(this.reserve, `Card ${reason}.`);
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

  protected end() {
    return { tracking: this.tracking, receipt: this.receipt };
  }

  protected back(reason: unknown) {
    this.notice = reason instanceof Error ? reason.message : String(reason);
  }
}

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
