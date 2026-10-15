import Model from '@expressive/mvc';

/**
 * Append-only paged data source. `more()` is re-entrant-safe, and the source
 * marks itself `done` when a page comes back empty.
 *
 * Ported from LFCP's `results()` instruction, which achieved the same thing by
 * hanging `more`/`loading` off the array and wiring a custom `[Observable]`
 * hook. As a Model the reactivity is ordinary and the exhaustion rule is
 * explicit rather than encoded as `more === undefined`.
 */
abstract class Source<T> extends Model {
  data: T[] = [];
  loading = false;
  done = false;
  error?: Error = undefined;

  /** Fetch the page starting at `offset`. Return empty to signal exhaustion. */
  abstract query(offset: number): Promise<T[]>;

  get empty() {
    return this.done && !this.data.length;
  }

  async more() {
    if (this.loading || this.done) return;

    this.loading = true;
    this.error = undefined;

    try {
      const next = await this.query(this.data.length);

      if (next && next.length) this.data = [...this.data, ...next];
      else this.done = true;
    } catch (error) {
      this.error = error instanceof Error ? error : new Error(String(error));
    } finally {
      this.loading = false;
    }
  }

  reset() {
    this.data = [];
    this.done = false;
    this.error = undefined;
  }
}

export { Source };
