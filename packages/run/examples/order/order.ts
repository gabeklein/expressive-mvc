import { Job } from '@expressive/run';

import { courier, inventory, mail, stripe, type Cart, type Charge } from './services';

export class SubmitOrder extends Job {
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

    this.pay();

    return () => inventory.release(hold);
  }

  protected async pay() {
    this.charge = await stripe.charge(this.cart.total);

    this.then(this.ship(this.charge.id), this.receipt(this.charge.receiptUrl));
    this.end();

    return this.refund(this.charge.id);
  }

  protected async ship(chargeId: string) {
    this.tracking = (await courier.book(this.cart, chargeId)).id;
  }

  protected async receipt(url: string) {
    await mail.send(this.cart.email, url);
  }

  protected async refund(chargeId: string) {
    await stripe.refund(chargeId);
  }

  protected end() {
    return { orderId: this.charge!.id, tracking: this.tracking };
  }

  protected back(error: unknown) {
    this.notice = `Order ${this.cart.id} was not placed: ${(error as Error).message}`;
  }
}
