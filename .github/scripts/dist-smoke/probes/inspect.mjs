import assert from 'node:assert/strict';
import '@expressive/inspect/install';
import State from '@expressive/mvc';
import { find, journal } from '@expressive/inspect';
import { inspect } from '@expressive/inspect/bridge';
import vite from '@expressive/inspect/vite';

class Composer extends State {
  draft = '';
  submit(text) { this.draft = text }
}

const composer = Composer.new();
const page = { evaluate: async (fn, arg) => fn(arg) };
const api = inspect(page);

assert.equal(typeof globalThis.__EXPRESSIVE_INSPECT__, 'object');
assert.equal(await api.get('Composer.draft'), '');

const frames = await find('Composer').act((s) => s.submit('hi'));

assert.equal(frames[0].events[0].key, 'draft');
assert.equal(composer.draft, 'hi');
assert.equal(journal.record().level, 'off');
assert.equal(vite().name, 'expressive-inspect');

console.log('inspect: install + act + bridge + vite ok');
