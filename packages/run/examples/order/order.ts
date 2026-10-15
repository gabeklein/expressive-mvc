import { Job } from '@expressive/run';

import { courier, inventory, mail, stripe, type Cart, type Charge } from './services';

export class SubmitOrder extends Job {
  // all or nothing: entries keep prior/patch, and a failed run puts every field back
  static readonly rewind = true;

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';
  notice = '';

  async next() {
    this.reserve();
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

    // one parallel group; end joins - it runs after everything else
    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
    this.end();

    // a returned step token is the undo: refund never runs forward, only on unwind
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
    this.end();
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  protected async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  // its return types `await order`
  protected end() {
    return { orderId: this.charge?.id, tracking: this.tracking };
  }

  // after any unwind - given back()'s reason, else the error; writes here are in no entry, so they survive rewind
  protected back(reason: unknown) {
    this.notice = `Order ${this.cart.id} was not placed: ${reason instanceof Error ? reason.message : reason}`;
  }
}
