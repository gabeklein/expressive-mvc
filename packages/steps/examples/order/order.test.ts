import { afterEach, expect, it, vi } from 'vitest';

import { journal, mockPromise, record } from '../../test.setup';
import { SubmitOrder } from './order';
import { courier, inventory, mail, stripe, type Cart } from './services';

const cart: Cart = { id: 'c1', email: 'a@b.c', items: ['sku'], total: 42 };

// a subclass keeping each entry its after hook is handed - read with record(order)
const Order = journal(SubmitOrder);

afterEach(() => vi.restoreAllMocks());

it('will run every step to end', async () => {
  const order = Order.new({ cart });

  // awaiting an idle instance runs next(); the result is typed by end()
  expect(await order).toEqual({ orderId: 'ch_42', tracking: 'trk_c1_ch_42' });
  expect(order.then.status).toBe('idle');
  expect(record(order).map((entry) => entry.id)).toEqual([
    'next#1',
    'reserve#1',
    'pay#1',
    'ship#1',
    'receipt#1',
    'end#1'
  ]);
});

it('will ship and send the receipt together', async () => {
  const booked = mockPromise<{ id: string } | undefined>();

  vi.spyOn(courier, 'book').mockReturnValue(booked);
  vi.spyOn(mail, 'send');

  const order = Order.new({ cart });
  const result = order.next();

  await vi.waitFor(() => expect(record(order).at(-1)?.id).toBe('receipt#1'));
  expect(mail.send).toHaveBeenCalled();
  expect(order.then.active).toBe('ship');

  booked.resolve({ id: 'trk_1' });
  expect(await result).toEqual({ orderId: 'ch_42', tracking: 'trk_1' });
});

it('will expose progress as fields', async () => {
  const held = mockPromise<string>();
  const charged = mockPromise<{ id: string; receiptUrl: string }>();

  vi.spyOn(inventory, 'hold').mockReturnValue(held);
  vi.spyOn(stripe, 'charge').mockReturnValue(charged);

  const order = Order.new({ cart });
  const seen: string[] = [];

  order.set('tracking', () => void seen.push(order.tracking));
  order.get((self) => void seen.push(`step:${self.then.active}`));

  const result = order.next();

  expect(order.charge).toBeUndefined();
  expect(stripe.charge).not.toHaveBeenCalled();

  held.resolve('h1');
  await expect(order).not.toHaveUpdated();
  expect(stripe.charge).toHaveBeenCalledWith(42);

  charged.resolve({ id: 'ch_1', receiptUrl: 'url' });
  await expect(order).toHaveUpdated('charge');

  expect(await result).toEqual({ orderId: 'ch_1', tracking: 'trk_c1_ch_1' });
  expect(seen).toContain('step:pay');
  expect(seen).toContain('trk_c1_ch_1');
  expect(seen.at(-1)).toBe('step:undefined');
});

it('will name the fields each step wrote', async () => {
  const order = Order.new({ cart });

  await order;

  const pay = record(order).find((entry) => entry.key == 'pay')!;

  // an entry names what its step wrote - values stay with the runtime, and only while an unwind may need them
  expect(pay.wrote).toEqual(['charge']);
  expect(pay).not.toHaveProperty('prior');
});

it('will snapshot the runner', async () => {
  const order = Order.new({ cart });

  await order;

  expect({ ...order.then }).toEqual({
    status: 'idle',
    active: undefined,
    queue: [],
    waiting: [],
    runs: 1,
    error: undefined
  });
});

it('will unwind what succeeded when a step fails', async () => {
  vi.spyOn(courier, 'book').mockRejectedValue(new Error('no couriers'));
  vi.spyOn(stripe, 'refund');
  vi.spyOn(inventory, 'release');

  const order = Order.new({ cart });

  await expect(order.next()).rejects.toThrow('no couriers');
  expect(order.then.status).toBe('failed');
  expect(stripe.refund).toHaveBeenCalledWith('ch_42');
  expect(inventory.release).toHaveBeenCalledWith('hold_sku');
  expect(order.charge).toBeUndefined();
  expect(order.notice).toBe('Order c1 was not placed: no couriers');
  // each step with an undo is undone and its fields restored - receipt returned none, so nothing ran for it
  expect(record(order).map((entry) => [entry.id, entry.undo && (entry.undo == 'closure' ? 'closure' : entry.undo.key), entry.undone])).toEqual([
    ['next#1', undefined, undefined],
    ['reserve#1', 'closure', true],
    ['pay#1', 'refund', true],
    ['receipt#1', undefined, undefined]
  ]);
});

it('will cancel the booking when the receipt fails', async () => {
  vi.spyOn(mail, 'send').mockRejectedValue(new Error('mailbox full'));
  vi.spyOn(courier, 'cancel');
  vi.spyOn(stripe, 'refund');

  const order = Order.new({ cart });

  await expect(order.next()).rejects.toThrow('mailbox full');
  // ship committed beside the failing receipt, so its inline undo ran
  expect(courier.cancel).toHaveBeenCalledWith('trk_c1_ch_42');
  expect(stripe.refund).toHaveBeenCalledWith('ch_42');
  expect(order.tracking).toBe('');
  expect(record(order).find((entry) => entry.key == 'ship')!.undo).toMatchObject({ key: 'then' });
});

it('will undo an order stopped mid-shipment', async () => {
  const booked = mockPromise<{ id: string } | undefined>();

  vi.spyOn(courier, 'book').mockReturnValue(booked);
  vi.spyOn(courier, 'cancel');
  vi.spyOn(stripe, 'refund');

  const order = Order.new({ cart });
  const result = order.next();

  await vi.waitFor(() => expect(order.then.active).toBe('ship'));
  order.then.stop(true);
  expect(order.then.status).toBe('stopped');

  // a step in flight settles and commits first, then the unwind takes it back too
  booked.resolve({ id: 'trk_1' });

  await expect(result).rejects.toMatchObject({ name: 'Stopped' });
  expect(courier.cancel).toHaveBeenCalledWith('trk_1');
  expect(stripe.refund).toHaveBeenCalledWith('ch_42');
  expect(order.charge).toBeUndefined();
  expect(order.notice).toBe(`Order c1 was not placed: ${order} was stopped.`);
});

it('will refund and backorder when no courier is free', async () => {
  vi.spyOn(courier, 'book').mockResolvedValue(undefined);
  vi.spyOn(stripe, 'refund');
  vi.spyOn(inventory, 'release');
  vi.spyOn(mail, 'send');

  const order = Order.new({ cart });

  // back() is not a failure: the run ends through backorder's end
  expect(await order.next()).toEqual({ orderId: undefined, tracking: '' });
  expect(order.then.status).toBe('idle');
  expect(stripe.refund).toHaveBeenCalledWith('ch_42');
  expect(inventory.release).not.toHaveBeenCalled();
  expect(mail.send).toHaveBeenCalledWith('a@b.c', 'https://orders.test/c1/backorder');
  // pay's undo refunded it and put its charge back; the back hook got the reason
  expect(order.charge).toBeUndefined();
  expect(order.notice).toBe('Order c1 was not placed: no courier');
  expect(record(order).map((entry) => [entry.id, entry.undone])).toEqual([
    ['next#1', undefined],
    ['reserve#1', undefined],
    ['pay#1', true],
    ['ship#1', undefined],
    ['receipt#1', undefined],
    ['backorder#1', undefined],
    ['end#2', undefined]
  ]);
});
