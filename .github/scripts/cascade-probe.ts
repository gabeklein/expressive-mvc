import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Browser, CHROME, until } from './chrome';
import { withWorkspaceLinks } from './workspace-links';

if (!await Bun.file(CHROME).exists()) {
  console.log(`No Chrome at ${CHROME} - set CHROME to run the cascade probe.`);
  process.exit(0);
}

const release = withWorkspaceLinks();
const dir = '.cascade-probe';

try {
  const built = await Bun.build({
    entrypoints: ['.github/scripts/cascade-probe.tsx'],
    target: 'browser',
    minify: false,
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  if (!built.success)
    throw new AggregateError(built.logs, 'Failed to bundle the cascade probe.');

  const script = await built.outputs[0].text();

  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(
        `<!doctype html><html><body><div id="app"></div>` +
        `<script type="module">${script}</script></body></html>`,
        { headers: { 'content-type': 'text/html' } }
      )
  });

  const profile = mkdtempSync(join(tmpdir(), 'cascade-probe-'));
  const browser = new Browser();
  let out: string | null = null;

  try {
    await browser.open(`http://localhost:${server.port}/`, profile);
    out = await until(() => browser.text('#out'), 10000).catch(() => null);
  } finally {
    await browser.close();
    server.stop(true);
    rmSync(profile, { recursive: true, force: true });
  }

  if (!out) {
    console.error('Probe produced no output.' + (browser.errors.length ? '\n' + browser.errors.join('\n') : ''));
    process.exit(1);
  }

  const lines = out.trim().split('\n');

  for (const line of lines) console.log(line);

  const failed = lines.filter((line) => line.startsWith('FAIL'));

  console.log(
    failed.length
      ? `\n${failed.length} cascade assertion(s) failed in Chrome.`
      : `\nCascade verified in Chrome: ${lines.length} assertions.`
  );

  if (failed.length) process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
  release();
}
