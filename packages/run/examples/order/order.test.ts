import { afterEach, expect, it, vi } from 'vitest';

import { mockPromise } from '../../test.setup';
import { SubmitOrder } from './order';
import { courier, inventory, mail, stripe, type Cart } from './services';

const cart: Cart = { id: 'c1', email: 'a@b.c', items: ['sku'], total: 42 };

afterEach(() => vi.restoreAllMocks());

it('will run every step to end', async () => {
  const order = SubmitOrder.new({ cart });

  expect(await order).toEqual({ orderId: 'ch_42', tracking: 'trk_c1_ch_42' });
  expect(order.then.status).toBe('idle');
  expect(order.then.record.map((entry) => entry.id)).toEqual([
    'next#1',
    'reserve#1',
    'pay#1',
    'ship#1',
    'receipt#1',
    'end#1'
  ]);
});

it('will ship and send the receipt together', async () => {
  const booked = mockPromise<{ id: string }>();

  vi.spyOn(courier, 'book').mockReturnValue(booked);
  vi.spyOn(mail, 'send');

  const order = SubmitOrder.new({ cart });
  const result = order.next();

  await vi.waitFor(() => expect(order.then.record.at(-1)?.id).toBe('receipt#1'));
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

  const order = SubmitOrder.new({ cart });
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

it('will unwind what succeeded when a step fails', async () => {
  vi.spyOn(courier, 'book').mockRejectedValue(new Error('no couriers'));
  vi.spyOn(stripe, 'refund');
  vi.spyOn(inventory, 'release');

  const order = SubmitOrder.new({ cart });

  await expect(order.next()).rejects.toThrow('no couriers');
  expect(order.then.status).toBe('failed');
  expect(stripe.refund).toHaveBeenCalledWith('ch_42');
  expect(inventory.release).toHaveBeenCalledWith('hold_sku');
  expect(order.charge).toBeUndefined();
  expect(order.then.record.map((entry) => [entry.id, entry.undo && (entry.undo == 'closure' ? 'closure' : entry.undo.key), entry.undone])).toEqual([
    ['next#1', undefined, true],
    ['reserve#1', 'closure', true],
    ['pay#1', 'refund', true],
    ['receipt#1', undefined, true]
  ]);
});
