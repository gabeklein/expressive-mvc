import { Steps } from '@expressive/steps';

import { courier, inventory, mail, stripe, type Cart, type Charge } from './services';

export class NoCourier extends Error {}

// all or nothing: a step that changes the world registers its compensation, and an unwind restores the fields of every step it takes back
export class SubmitOrder extends Steps {
  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';
  notice = '';

  // run takes the arguments, schedules, awaits the run and returns its result - typing `await order`
  async run() {
    this.reserve();

    // the tail runs after the unwind, on the restored fields - a write here is in no entry
    try {
      await this;
    } catch (error) {
      this.notice = `Order ${this.cart.id} was not placed: ${(error as Error).message}`;
      throw error;
    }

    return { orderId: this.charge?.id, tracking: this.tracking };
  }

  protected async reserve() {
    const hold = await inventory.hold(this.cart.items);

    // a compensation runs only on unwind; the steps it calls run as part of the unwind
    this.then.catch(() => {
      this.release(hold);
    });

    // calling a step schedules it - pay runs once reserve settles; if pay or anything it schedules fails, noCourier runs in its place
    this.pay().catch(this.noCourier);
  }

  protected async release(hold: string) {
    await inventory.release(hold);
  }

  // a .catch handler runs once the failed branch is unwound - pay refunded; it recovers by scheduling, or throws to keep failing
  protected async noCourier(error: unknown) {
    if (!(error instanceof NoCourier)) throw error;

    // a handler's own writes are kept
    this.notice = `Order ${this.cart.id} was not placed: no courier`;
    this.backorder();
  }

  protected async pay() {
    const charge = await stripe.charge(this.cart.total);

    this.charge = charge;
    this.then.catch(() => {
      this.refund(charge.id);
    });

    // one parallel group; the run ends once it is done - then.end() must be the last call
    this.then(this.ship(charge.id), this.receipt(charge.receiptUrl));
    this.then.end();
  }

  protected async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  protected async ship(chargeId: string) {
    const booking = await courier.book(this.cart, chargeId);

    // no courier free: fail with a type the plan handles - pay is refunded, the hold kept, and the order backordered
    if (!booking) throw new NoCourier('no courier');

    this.tracking = booking.id;

    // ship owns its compensation - cancelled if receipt, beside it, fails
    this.then.catch(() => {
      this.cancel(booking.id);
    });
  }

  protected async cancel(tracking: string) {
    await courier.cancel(tracking);
  }

  protected async backorder() {
    await mail.send(this.cart.email, `https://orders.test/${this.cart.id}/backorder`);
    this.then.end();
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }
}
