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

    // a mapped group - visit per site, in parallel; a failed visit is replayed with its args, recorded
    this.then(this.sites, (site) => this.visit(site).catch(this.then.retry));

    // best effort - a failing post is caught and skipped, and the run still ends
    this.report().catch();

    // the run's result - typing `await crawl`
    await this;

    return [...this.products.values()];
  }

  protected async visit(site: string) {
    const { retried } = this.then;

    // the retried step ends its own loop - give up by scheduling the fallback and returning; a throw would retry again
    if (retried > 3) return void this.skip(site);

    // at most `limit` sites at once - read through `$`, so a UI raising or lowering it mid-run takes effect
    // a replay waits 1s, 2s, then 4s first, then queues behind the sites already waiting
    this.then.slot({
      max: ($) => $.limit,
      after: retried && SECOND * 2 ** (retried - 1)
    });

    this.scan(site);
  }

  protected async scan(site: string) {
    const found = await browser.search(site, this.query, { signal: this.then.signal });

    // parallel scans share one map; each scan's own sets are undone if it fails, never a sibling's
    for (const product of found)
      if (!this.products.has(product.sku)) this.products.set(product.sku, product);
  }

  protected async skip(site: string) {
    this.skipped.push(site);
  }

  protected async report() {
    await stats.post(this.query, this.products.size);
  }
}
