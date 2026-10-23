import { afterEach, expect, it, vi } from 'vitest';

import { flushMicrotasks, journal, mockPromise, record } from '../../test.setup';
import { Crawl } from './crawl';
import { browser, SECOND, stats, type Product } from './services';

const product = (sku: string, site: string): Product => ({ sku, name: sku, price: 10, site });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('will dedupe products from every site', async () => {
  vi.spyOn(browser, 'search').mockImplementation(async (site) =>
    site == 'a' ? [product('lamp', 'a'), product('desk', 'a')] : [product('lamp', site), product('chair', site)]
  );

  const crawl = Crawl.new({ sites: ['a', 'b', 'c'] });

  crawl.next('office');

  // awaiting the instance joins the run, typed by end
  const found = await crawl;

  expect(found.map((item) => [item.sku, item.site])).toEqual([
    ['lamp', 'a'],
    ['desk', 'a'],
    ['chair', 'b']
  ]);
});

it('will scan at most limit sites at once, following a limit changed mid-run', async () => {
  const pages = new Map(['a', 'b', 'c', 'd'].map((site) => [site, mockPromise<Product[]>()]));
  const started: string[] = [];

  vi.spyOn(browser, 'search').mockImplementation((site) => {
    started.push(site);
    return pages.get(site)!;
  });

  const crawl = Crawl.new({ sites: ['a', 'b', 'c', 'd'] });

  crawl.next('office');

  await flushMicrotasks();
  expect(started).toEqual(['a', 'b']);

  // limit is read live - raising it starts the next site in line at once
  crawl.limit = 3;
  await flushMicrotasks();
  expect(started).toEqual(['a', 'b', 'c']);

  // lowering it lets scans in flight finish; nothing new starts until fewer are running
  crawl.limit = 1;
  pages.get('a')!.resolve([]);
  pages.get('b')!.resolve([]);
  await flushMicrotasks();
  expect(started).toEqual(['a', 'b', 'c']);

  pages.get('c')!.resolve([]);
  await flushMicrotasks();
  expect(started).toEqual(['a', 'b', 'c', 'd']);

  pages.get('d')!.resolve([product('lamp', 'd')]);
  expect(await crawl).toEqual([product('lamp', 'd')]);
});

it('will retry a failing site with backoff, keeping what other sites found', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const search = vi.spyOn(browser, 'search');

  search.mockImplementation(async (site) => [product(`${site}-sku`, site)]);
  search.mockRejectedValueOnce(new Error('timeout'));

  const crawl = journal(Crawl).new({ sites: ['a', 'b'] });

  crawl.next('office');

  // joins the run now - it may end before the next await
  const found = Promise.resolve(crawl);

  await vi.advanceTimersByTimeAsync(0);
  expect(crawl.products.get('b-sku')).toBeDefined();
  expect(crawl.products.get('a-sku')).toBeUndefined();

  await vi.advanceTimersByTimeAsync(SECOND);
  expect((await found).map((item) => item.sku)).toEqual(['b-sku', 'a-sku']);

  // the failed scan never commits; visit's re-run carries retry 1
  expect(record(crawl).filter((entry) => entry.retry).map((entry) => [entry.id, entry.retry])).toEqual([['visit#3', 1]]);
});

it('will skip a site after three retries', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  vi.spyOn(browser, 'search').mockImplementation(async (site) => {
    if (site == 'down') throw new Error('blocked');
    return [product('lamp', site)];
  });

  const crawl = Crawl.new({ sites: ['down', 'up'] });

  crawl.next('office');

  const found = Promise.resolve(crawl);

  await vi.advanceTimersByTimeAsync(7 * SECOND);

  expect(await found).toEqual([product('lamp', 'up')]);
  expect(crawl.skipped.get()).toEqual(['down: blocked']);
});

it('will end even when the report fails', async () => {
  vi.spyOn(stats, 'post').mockRejectedValue(new Error('offline'));

  const crawl = journal(Crawl).new({ sites: ['a'] });

  crawl.next('office');

  expect(await crawl).toHaveLength(1);
  expect(stats.post).toHaveBeenCalled();
  expect(record(crawl).some((entry) => entry.key == 'report')).toBe(false);
});
