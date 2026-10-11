import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const pages = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) return [];
    return existsSync(join(path, 'App.tsx')) ? [path] : pages(path);
  });

test('will have a spec beside every example', () => {
  test.skip(test.info().project.name != 'react', 'host-independent');

  const missing = pages('pages').filter((dir) => !existsSync(join(dir, 'App.spec.ts')));
  expect(missing).toEqual([]);
});
