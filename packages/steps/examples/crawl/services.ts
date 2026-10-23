export interface Product {
  sku: string;
  name: string;
  price: number;
  site: string;
}

export const SECOND = 1000;

export const browser = {
  async search(site: string, query: string, { signal }: { signal: AbortSignal }): Promise<Product[]> {
    signal.throwIfAborted();

    return [{ sku: `${query}-1`, name: query, price: site.length, site }];
  }
};

export const stats = {
  async post(query: string, found: number): Promise<void> {
    void query;
    void found;
  }
};
