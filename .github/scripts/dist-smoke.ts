import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Pack every publishable package, install the tarballs into a throwaway project
 * outside the repo, and execute the result under native Node ESM. Nothing else
 * in CI resolves the built dist the way a consumer does: vitest aliases the
 * scope onto sources, and `npm publish --dry-run` runs no code at all.
 *
 * Probes and the consumer app live in `dist-smoke/`, copied into the fixture so
 * their bare imports resolve against the installed tarballs. The consumer is a
 * dom app built the way a consumer builds one: type-checked against the
 * published declarations with `skipLibCheck` off, bundled and minified so
 * `sideEffects` tree-shaking applies, then driven under happy-dom.
 */
const PACKAGES = ['mvc', 'react', 'dom', 'router', 'inspect'];

function run(cmd: string[], cwd: string) {
  const { exitCode, stdout, stderr } = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const out = stdout.toString();
  const err = stderr.toString();

  if (exitCode !== 0)
    throw new Error(`\`${cmd.join(' ')}\` failed in ${cwd}:\n${out}\n${err}`);

  return out;
}

const ROOT = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const fixture = mkdtempSync(join(tmpdir(), 'expressive-dist-smoke-'));
const tarballs: Record<string, string> = {};

try {
  for (const name of PACKAGES) {
    const packed = run(
      ['npm', 'pack', '--json', '--pack-destination', fixture],
      resolve('packages', name)
    );
    const [{ filename }] = JSON.parse(packed);

    tarballs[`@expressive/${name}`] = `file:./${filename}`;
    console.log(`packed @expressive/${name} -> ${filename}`);
  }

  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify(
      {
        name: 'dist-smoke',
        version: '0.0.0',
        private: true,
        type: 'module',
        dependencies: {
          ...tarballs,
          react: '^19',
          'react-dom': '^19',
          'happy-dom': ROOT.devDependencies['happy-dom'],
          typescript: ROOT.devDependencies.typescript
        },
        overrides: tarballs
      },
      null,
      2
    )
  );

  run(['npm', 'install', '--no-audit', '--no-fund', '--loglevel=error'], fixture);

  cpSync(resolve('.github/scripts/dist-smoke'), fixture, { recursive: true });

  for (const name of PACKAGES)
    process.stdout.write(run(['node', `probes/${name}.mjs`], fixture));

  const consumer = join(fixture, 'consumer');

  run(['node', '../node_modules/typescript/bin/tsc', '-p', '.'], consumer);
  run(['bun', 'build', 'app.tsx', '--outfile', 'bundle.js', '--format', 'esm', '--minify'], consumer);
  process.stdout.write(run(['node', 'consumer.mjs'], consumer));
} catch (error) {
  console.error(`Fixture kept for inspection: ${fixture}`);
  throw error;
}

rmSync(fixture, { recursive: true, force: true });

console.log('\nPublished dist imports and executes under Node ESM.');
