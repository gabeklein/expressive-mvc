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

  async run(query: string) {
    this.query = query;

    // a mapped group - visit per site, in parallel
    this.then(this.sites, (site) => this.visit(undefined, site));

    // best effort - a failing post is caught and skipped, and the run still ends
    this.report().catch();

    // the run's result - typing `await crawl`
    await this;

    return [...this.products.values()];
  }

  // a step and its own .catch handler: the error comes first, unused on a first try
  protected async visit(_error: unknown, site: string) {
    // at most `limit` sites at once - read through `$`, so a UI raising or lowering it mid-run takes effect
    // a re-run waits 1s, 2s, then 4s first, then queues behind the sites already waiting
    this.then.slot({
      max: ($) => $.limit,
      after: this.then.retry && SECOND * 2 ** (this.then.retry - 1)
    });

    // a failed scan runs visit again in its place, given the error then the scan's args, retry counting up;
    // after three, skip - the group settles with the sites that answered
    this.scan(site).catch(this.then.retry < 3 ? this.visit : this.skip);
  }

  protected async scan(site: string) {
    const found = await browser.search(site, this.query, { signal: this.then.signal });

    // parallel scans share one map; each scan's own sets are undone if it fails, never a sibling's
    for (const product of found)
      if (!this.products.has(product.sku)) this.products.set(product.sku, product);
  }

  // a .catch handler gets the error, then the failed token's args
  protected async skip(error: unknown, site: string) {
    this.skipped.push(`${site}: ${(error as Error).message}`);
  }

  protected async report() {
    await stats.post(this.query, this.products.size);
  }
}
