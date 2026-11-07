import { has, map } from '@expressive/mvc';
import { Steps } from '@expressive/steps';

import { browser, stats, type Product } from './services';

// many sites scanned at once into one live, deduped list - limit and retries read as the run goes
export class Crawl extends Steps {
  sites: string[] = [];
  query = '';
  limit = 2;
  products = map<string, Product>();
  skipped = has<string>();

  async run(query: string) {
    this.query = query;

    // a mapped group - visit per site, in parallel; a failed visit runs revisit in its place
    this.then(this.sites, (site) => this.visit(site).catch(this.revisit));

    // best effort - a failing post is caught and skipped, and the run still ends
    this.report().catch();

    // the run's result - typing `await crawl`
    await this;

    return [...this.products.values()];
  }

  protected async visit(site: string) {
    const { retried } = this.then;

    // a replay waits 1s, 2s, then 4s first, then queues behind the sites already waiting
    if (retried) this.then({ sec: 2 ** (retried - 1) });

    // a gate: only `limit` sites at once - read through `$`, so a UI raising or lowering it mid-run takes effect
    this.then.only(($) => $.limit);

    this.scan(site);
  }

  protected async scan(site: string) {
    const found = await browser.search(site, this.query, { signal: this.then.signal });

    // parallel scans share one map; each scan's own sets are undone if it fails, never a sibling's
    for (const product of found)
      if (!this.products.has(product.sku)) this.products.set(product.sku, product);
  }

  // a step method as the handler - recorded, given the error; it holds the retry policy: replay visit with its
  // args up to three times, then note why and let the group settle with the sites that answered
  protected async revisit(error: unknown) {
    if (this.then.retried < 3) this.then.retry();
    else this.skipped.push((error as Error).message);
  }

  protected async report() {
    await stats.post(this.query, this.products.size);
  }
}
