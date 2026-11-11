import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, it } from 'vitest';

import { dispatch } from './bin';

let root: string;
let lines: string[];

const out = { log: (line: string) => void lines.push(line), error: (line: string) => void lines.push(line) };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'expressive-bin-'));
  lines = [];
});

afterEach(() => {
  rmSync(root, { recursive: true });
});

function install(at: string, name: string, manifest: unknown, code = 0) {
  const dir = join(at, 'node_modules', '@expressive', name);

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), typeof manifest == 'string' ? manifest : JSON.stringify(manifest));
  writeFileSync(join(dir, 'cli.mjs'), `export default async (args, out) => (out.log('${name} ' + args.join(' ')), ${code});\n`);
}

it("will run a package's command", async () => {
  install(root, 'sql', { expressive: { bin: './cli.mjs' } }, 3);

  expect(await dispatch(['sql', 'check', 'x.ts'], root, out)).toBe(3);
  expect(lines).toEqual(['sql check x.ts']);
});

it('will find a command in a parent folder, nearest first', async () => {
  const app = join(root, 'app');

  install(root, 'sql', { expressive: { bin: './cli.mjs' } }, 4);
  install(root, 'dev', { expressive: { bin: './cli.mjs' } }, 5);
  install(app, 'dev', { expressive: { bin: './cli.mjs' } }, 6);

  expect(await dispatch(['sql'], app, out)).toBe(4);
  expect(await dispatch(['dev'], app, out)).toBe(6);
});

it('will run commands a package names', async () => {
  install(root, 'dev', { expressive: { bin: { dev: './cli.mjs', build: './cli.mjs' } } }, 8);
  install(root, 'sql', { expressive: { bin: './cli.mjs' } });

  expect(await dispatch(['build', '--pretty'], root, out)).toBe(8);
  expect(await dispatch([], root, out)).toBe(2);
  expect(lines).toEqual([
    'dev --pretty',
    'Usage: expressive <command> ... Available: dev, build, sql.'
  ]);
});

it('will list commands when unknown or missing', async () => {
  install(root, 'sql', { expressive: { bin: './cli.mjs' } });
  install(root, 'mvc', { name: '@expressive/mvc' });
  install(root, 'broken', '{');

  expect(await dispatch(['nope'], root, out)).toBe(2);
  expect(await dispatch([], root, out)).toBe(2);
  expect(lines).toEqual([
    'No expressive command "nope". Available: sql.',
    'Usage: expressive <command> ... Available: sql.'
  ]);
});

it('will say when nothing is installed', async () => {
  expect(await dispatch(['sql'], root, out)).toBe(2);
  expect(lines[0]).toMatch(/Available: none installed\.$/);
});
