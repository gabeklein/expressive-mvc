// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

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

describe('main', () => {
  it('will boot without an embedded context', async () => {
    await import('./main');
    expect(document.body.textContent).toContain('Connecting');
  });
});
