import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config, serve, Cookies } from '@expressive/dev/server';
import { expressive, runDev, runBuild } from '@expressive/dev/vite';

for (const [name, value] of Object.entries({ config, serve, Cookies, expressive, runDev, runBuild }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

const manifest = JSON.parse(readFileSync('node_modules/@expressive/dev/package.json', 'utf8'));

for (const [name, range] of Object.entries(manifest.dependencies))
  assert.ok(!range.startsWith('workspace:'), `${name} is published as ${range}`);

const plugins = [expressive()].flat();
assert.ok(plugins.length > 0 && plugins.every(plugin => typeof plugin.name === 'string'), 'expressive() returns Vite plugins');

console.log('dev: server and vite entries ok');
