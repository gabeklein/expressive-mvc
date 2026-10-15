export interface Item {
  id: string;
}

export interface Page {
  items: Item[];
  next?: string;
}

const PAGES: { [cursor: string]: Page } = {
  '': { items: [{ id: 'a' }, { id: 'b' }], next: 'p2' },
  p2: { items: [{ id: 'b' }, { id: 'c' }] }
};

export const api = {
  async page(cursor: string, { signal }: { signal: AbortSignal }): Promise<Page> {
    signal.throwIfAborted();
    return PAGES[cursor];
  },
  async ack(cursor: string, { signal }: { signal: AbortSignal }): Promise<void> {
    void cursor;
    signal.throwIfAborted();
  }
};
