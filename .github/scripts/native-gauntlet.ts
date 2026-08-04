import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PINS = {
  expo: '~57.0.9',
  react: '19.2.3',
  'react-native': '0.86.2'
};

const PACKAGES = ['mvc', 'react', 'router'];
const PORT = 19555;
const PLATFORM = process.argv[2] === 'android' ? 'android' : 'ios';

const workspace = await mkdtemp(join(tmpdir(), 'expressive-gauntlet-'));

const report = Promise.withResolvers<[string, boolean, string][]>();

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    if (new URL(request.url).pathname === '/result')
      report.resolve(await request.json());

    return new Response('ok');
  }
});

const timeout = setTimeout(
  () => report.reject(new Error('The app never reported. See the log above.')),
  10 * 60 * 1000
);

try {
  await Bun.write(join(workspace, 'package.json'), JSON.stringify({
    name: 'gauntlet',
    version: '1.0.0',
    main: 'index.js',
    private: true,
    dependencies: PINS
  }));

  await Bun.write(join(workspace, 'app.json'), JSON.stringify({
    expo: {
      name: 'gauntlet',
      slug: 'gauntlet',
      platforms: ['ios', 'android'],
      ios: { bundleIdentifier: 'dev.expressive.gauntlet' },
      android: { package: 'dev.expressive.gauntlet' }
    }
  }));

  await Bun.write(join(workspace, 'index.js'),
    "import { registerRootComponent } from 'expo';\n" +
    "import App from './App';\n" +
    'registerRootComponent(App);\n');

  await Bun.write(join(workspace, 'App.tsx'),
    await Bun.file('.github/scripts/native-gauntlet.tsx').text());

  await $`npm install --silent --no-audit --no-fund`.cwd(workspace);

  const tarballs: string[] = [];

  for (const name of PACKAGES) {
    const packed = await $`npm pack --silent --pack-destination ${workspace}`
      .cwd(`packages/${name}`).text();

    tarballs.push(join(workspace, packed.trim()));
  }

  await $`npm install --silent --no-audit --no-fund ${tarballs}`.cwd(workspace);

  const run = $`npx expo run:${PLATFORM}`.cwd(workspace).env({
    ...process.env,
    CI: '1',
    EXPO_NO_TELEMETRY: '1'
  });

  const results = await Promise.race([
    report.promise,
    run.then(() => report.promise)
  ]);

  const failed = results.filter(([, pass]) => !pass);

  for (const [name, pass, detail] of results)
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${name} - ${detail}`);

  if (failed.length)
    throw new Error(`${failed.length} of ${results.length} checks failed on ${PLATFORM}.`);

  console.log(`\n${results.length - 1} checks passed on ${PLATFORM}.`);
}
finally {
  clearTimeout(timeout);
  server.stop(true);
  await rm(workspace, { recursive: true, force: true });
}
