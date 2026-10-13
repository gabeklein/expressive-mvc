import { State } from '@expressive/mvc';
import { run } from '@expressive/run';

import { courier, inventory, mail, stripe, type Cart, type Charge } from './services';

export class SubmitOrder extends State {
  run = run(this);

  cart!: Cart;
  charge?: Charge = undefined;
  tracking = '';

  protected new() {
    this.reserve();
  }

  async reserve() {
    await inventory.hold(this.cart.items);
    this.pay();
  }

  async pay() {
    const charge = await stripe.charge(this.cart.total);
    this.charge = charge;
    this.ship(charge.id);
  }

  async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
    this.receipt(this.charge!.receiptUrl);
  }

  async receipt(url: string) {
    await mail.send(this.cart.email, url);
    this.done();
  }

  done() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }
}
