import { Steps } from '@expressive/steps';

import { courier, inventory, mail, stripe, type Cart, type Charge } from './services';

// all or nothing: every step that writes a field returns its undo, so a failed run puts each field back
export class SubmitOrder extends Steps {
  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';
  notice = '';

  // next takes the arguments, schedules, awaits the run and returns its result - typing `await order`
  async next() {
    this.reserve();

    await this;

    return { orderId: this.charge?.id, tracking: this.tracking };
  }

  protected async reserve() {
    const hold = await inventory.hold(this.cart.items);

    // calling a step schedules it - pay runs once reserve settles
    this.pay();

    // a returned closure is this step's undo; runs only on unwind
    return () => inventory.release(hold);
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);

    // one parallel group; the run ends once it is done - then.end() must be the last call
    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
    this.then.end();

    // a returned step token is the undo: refund never runs forward, only on unwind - and charge is restored after it
    return this.refund(this.charge.id);
  }

  protected async ship(chargeId: string) {
    const booking = await courier.book(this.cart, chargeId);

    if (booking) {
      this.tracking = booking.id;

      // a returned inline step is the undo, typed void so ship stays Promise<void>
      return this.then(() => courier.cancel(booking.id));
    }

    // no courier free: fail forward - unwind what committed after reserve (pay is refunded,
    // receipt dropped), keep the hold, and backorder; the run does not fail
    this.then.back(this.reserve, 'no courier');
    this.backorder();
  }

  protected async backorder() {
    await mail.send(this.cart.email, `https://orders.test/${this.cart.id}/backorder`);
    this.then.end();
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  protected async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  // after any unwind - given back()'s reason, else the error; writes here are in no entry, so no unwind restores them
  protected back(reason: unknown) {
    this.notice = `Order ${this.cart.id} was not placed: ${reason instanceof Error ? reason.message : reason}`;
  }
}
