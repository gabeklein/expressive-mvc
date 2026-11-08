import assert from 'node:assert/strict';
import { Cookies, Current, HttpError, NotFound, client } from '@expressive/rpc';
import { handler } from '@expressive/rpc/http';
import { install } from '@expressive/rpc/protocol';

// What the generated server does first: Current and seats resolve per call.
install();

for (const [name, value] of Object.entries({ Cookies, Current, HttpError, NotFound, client, handler }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

class Prefs extends Cookies {
  theme = undefined;
}

const calls = {
  later: async (when, step) => new Date(when.getTime() + Number(step)),
  theme: async name => {
    Prefs.set({ theme: name });
    return Current.get().url.pathname;
  },
  missing: async () => {
    throw new NotFound('No such thing.');
  }
};

const handle = handler([{ pattern: ['clock'], exports: async () => ({ calls, classes: {} }) }]);
const rpc = client({ base: 'http://localhost', transport: async request => (await handle(request)) });

const at = await rpc.call('/clock', 'later', [new Date('2026-01-01T00:00:00.000Z'), 1000n]);
assert.deepEqual(at, new Date('2026-01-01T00:00:01.000Z'));

const reply = await handle(
  new Request('http://localhost/clock', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-expressive-call': 'theme' },
    body: '["dark"]'
  })
);
assert.equal(reply.status, 200);
assert.match(reply.headers.get('set-cookie'), /^theme=dark; Path=\/; HttpOnly; SameSite=Lax/);

await assert.rejects(rpc.call('/clock', 'missing', []), error => error instanceof HttpError && error.status === 404);

console.log('rpc: codec, Cookies, errors over a call ok');
