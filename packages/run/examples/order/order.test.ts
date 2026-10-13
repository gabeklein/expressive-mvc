import { afterEach, expect, it, vi } from 'vitest';

import { mockPromise } from '../../test.setup';
import { SubmitOrder } from './order';
import { courier, inventory, stripe, type Cart } from './services';

const cart: Cart = { id: 'c1', email: 'a@b.c', items: ['sku'], total: 42 };

afterEach(() => vi.restoreAllMocks());

it('will run every step to done', async () => {
  const order = SubmitOrder.new({ cart });

  expect(await order.run).toEqual({ orderId: 'ch_42', tracking: 'trk_c1_ch_42' });
  expect(order.run.status).toBe('done');
  expect(order.run.entries.map((entry) => `${entry.key} > ${entry.next}`)).toEqual([
    'new > reserve',
    'reserve > pay',
    'pay > ship',
    'ship > receipt',
    'receipt > done',
    'done > undefined'
  ]);
});

it('will expose progress as fields', async () => {
  const held = mockPromise();
  const charged = mockPromise<{ id: string; receiptUrl: string }>();

  vi.spyOn(inventory, 'hold').mockReturnValue(held);
  vi.spyOn(stripe, 'charge').mockReturnValue(charged);

  const order = SubmitOrder.new({ cart });
  const seen: string[] = [];

  order.set('tracking', () => void seen.push(order.tracking));

  expect(order.charge).toBeUndefined();
  await expect(order.run).toHaveUpdated('step');
  expect(order.run.step).toBe('reserve');
  expect(stripe.charge).not.toHaveBeenCalled();

  held.resolve();
  await expect(order.run).toHaveUpdated('step');
  expect(order.run.step).toBe('pay');
  expect(stripe.charge).toHaveBeenCalledWith(42);

  charged.resolve({ id: 'ch_1', receiptUrl: 'url' });
  await expect(order).toHaveUpdated('charge');

  expect(await order.run).toEqual({ orderId: 'ch_1', tracking: 'trk_c1_ch_1' });
  expect(seen).toEqual(['trk_c1_ch_1']);
});

it('will reject when a step throws', async () => {
  vi.spyOn(courier, 'book').mockRejectedValue(new Error('no couriers'));

  const order = SubmitOrder.new({ cart });

  await expect(order.run).rejects.toThrow('no couriers');
  expect(order.run.status).toBe('failed');
  expect(order.run.error).toEqual(new Error('no couriers'));
});
