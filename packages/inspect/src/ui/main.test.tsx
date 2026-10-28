// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { flushMicrotasks } from '../../test.setup';

class FakeSocket {
  onopen: any = null;
  onerror: any = null;
  onmessage: any = null;
  onclose: any = null;

  constructor(readonly url: string, readonly protocol?: string) {
    queueMicrotask(() => this.onopen?.({}));
  }

  send() {}
  close() {}
}

vi.stubGlobal('WebSocket', FakeSocket);
(globalThis as any).__EXPRESSIVE_DEVTOOLS__ = { token: 't', ws: '', base: '/' };

describe('main', () => {
  it('will boot the panel', async () => {
    await import('./main');
    expect(document.body.textContent).toContain('Connecting');
  });
});
