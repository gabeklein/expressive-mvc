import { withWorkspaceLinks } from './workspace-links';

const CHROME = process.env.CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!await Bun.file(CHROME).exists()) {
  console.log(`No Chrome at ${CHROME} - set CHROME to run the three probe.`);
  process.exit(0);
}

const release = withWorkspaceLinks();

try {
  const built = await Bun.build({
    entrypoints: ['.github/scripts/three-probe.tsx'],
    target: 'browser',
    minify: false,
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  if (!built.success)
    throw new AggregateError(built.logs, 'Failed to bundle the three probe.');

  const script = await built.outputs[0].text();

  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(
        `<!doctype html><html><body style="margin:0">` +
        `<script type="module">${script}</script></body></html>`,
        { headers: { 'content-type': 'text/html' } }
      )
  });

  const proc = Bun.spawn([
    CHROME,
    '--headless=new',
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--virtual-time-budget=5000',
    '--dump-dom',
    `http://localhost:${server.port}/`
  ], { stdout: 'pipe', stderr: 'ignore' });

  const dom = await new Response(proc.stdout).text();
  server.stop(true);

  const match = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);

  if (!match) {
    console.error('Probe produced no output. Chrome returned:\n' + dom.slice(0, 600));
    process.exit(1);
  }

  const lines = match[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .trim().split('\n');

  for (const line of lines) console.log(line);

  const failed = lines.filter((line) => line.startsWith('FAIL'));

  console.log(
    failed.length
      ? `\n${failed.length} draw assertion(s) failed in Chrome.`
      : `\nDrawing verified in Chrome: ${lines.length} assertions.`
  );

  if (failed.length) process.exit(1);
} finally {
  release();
}
