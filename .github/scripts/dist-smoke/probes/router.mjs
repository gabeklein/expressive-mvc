import assert from 'node:assert/strict';
import { Router, BrowserRouter, Route, Link, Redirect, NavLinks, matchPattern } from '@expressive/router';

for (const [name, value] of Object.entries({ Router, BrowserRouter, Route, Link, Redirect, NavLinks, matchPattern }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

assert.deepEqual(matchPattern('/user/:id', '/user/42').params, { id: '42' });

console.log('router: import shape ok');
