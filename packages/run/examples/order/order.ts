import { State } from '@expressive/mvc';
import { run } from '@expressive/run';

import { courier, inventory, mail, stripe, type Cart, type Charge } from './services';

export class SubmitOrder extends State {
  then = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  protected new() {
    this.reserve();
  }

  async reserve() {
    const hold = await inventory.hold(this.cart.items);

    this.pay();

    return () => inventory.release(hold);
  }

  async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.ship(this.charge.id);
    this.receipt(this.charge.receiptUrl);
    this.done();

    return this.refund(this.charge.id);
  }

  async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
  }

  async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  done() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}
