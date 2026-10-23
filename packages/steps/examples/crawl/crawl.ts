import { has, map } from '@expressive/mvc';
import { Steps } from '@expressive/steps';

import { browser, SECOND, stats, type Product } from './services';

// many sites scanned at once into one live, deduped list - limit and retries read as the run goes
export class Crawl extends Steps {
  sites: string[] = [];
  query = '';
  limit = 2;
  products = map<string, Product>();
  skipped = has<string>();

  async next(query: string) {
    this.query = query;

    // a mapped group - visit(site, index) per site, in parallel
    this.then(this.sites, this.visit);

    // best effort - a failing post is caught and skipped, and the run still ends
    this.report().catch();
    this.end();
  }

  protected async visit(site: string) {
    // at most `limit` sites at once - read through `$`, so a UI raising or lowering it mid-run takes effect
    // a re-run waits 1s, 2s, then 4s first, then queues behind the sites already waiting
    this.then.slot({
      max: ($) => $.limit,
      after: this.then.retry && SECOND * 2 ** (this.then.retry - 1)
    });

    // a failed scan runs visit again in its place, retry counting up; after three, skip -
    // the group settles with the sites that answered
    this.scan(site).catch(this.then.retry < 3 ? this.visit : this.skip);
  }

  protected async scan(site: string) {
    const found = await browser.search(site, this.query, { signal: this.then.signal });

    // parallel scans share one map; each scan's own sets are undone if it fails, never a sibling's
    for (const product of found)
      if (!this.products.has(product.sku)) this.products.set(product.sku, product);
  }

  // a .catch handler gets the failed token's args, and the error as this.then.caught
  protected async skip(site: string) {
    this.skipped.push(`${site}: ${(this.then.caught as Error).message}`);
  }

  protected async report() {
    await stats.post(this.query, this.products.size);
  }

  protected end() {
    return [...this.products.values()];
  }
}
