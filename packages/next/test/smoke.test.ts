import { expect, it } from 'bun:test';

const cwd = new URL('..', import.meta.url).pathname;
const next = new URL('../../../node_modules/.bin/next', import.meta.url).pathname;

async function output(process: ReturnType<typeof Bun.spawn>) {
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ]);

  return { stdout, stderr, exitCode };
}

async function waitFor(url: string, process: ReturnType<typeof Bun.spawn>) {
  for (let attempts = 0; attempts < 100; attempts++) {
    if (process.exitCode !== null)
      throw new Error(`Next.js exited before serving ${url}.`);

    try {
      return await fetch(url);
    } catch {
      await Bun.sleep(100);
    }
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

it('will render React adapter primitives through Next.js', async () => {
  const build = await output(Bun.spawn([next, 'build'], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe'
  }));

  expect(build.exitCode, `${build.stdout}\n${build.stderr}`).toBe(0);

  const port = 40_000 + process.pid % 10_000;
  const server = Bun.spawn([next, 'start', '-p', String(port)], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const stdout = new Response(server.stdout).text();
  const stderr = new Response(server.stderr).text();

  try {
    const response = await waitFor(`http://localhost:${port}?initial=3`, server);
    const html = await response.text();
    const nextResponse = await fetch(`http://localhost:${port}?initial=7`);
    const nextHtml = await nextResponse.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Count: <!-- -->3');
    expect(html).toContain('Hello from context');
    expect(html).toContain('Server slot: <!-- -->3');
    expect(html).toContain('data-context="Request 3">Request 3');
    expect(html).toContain('data-streamed="3">Streamed request 3');
    expect(html).toContain('Hello, <!-- -->Next.js');
    expect(nextResponse.status).toBe(200);
    expect(nextHtml).toContain('Count: <!-- -->7');
    expect(nextHtml).not.toContain('Count: <!-- -->3');

    const concurrent = await Promise.all(
      Array.from({ length: 12 }, async (_, value) => {
        const response = await fetch(`http://localhost:${port}?initial=${value}`);
        return [value, response.status, await response.text()] as const;
      })
    );

    for (const [value, status, html] of concurrent) {
      expect(status).toBe(200);
      expect(html).toContain(`Count: <!-- -->${value}`);
      expect(html).toContain(`data-context="Request ${value}">Request ${value}`);
      expect(html).toContain(
        `data-streamed="${value}">Streamed request ${value}`
      );
    }
  } finally {
    server.kill();
    await server.exited;
  }

  expect(await stderr, await stdout).toBe('');
}, 120_000);
