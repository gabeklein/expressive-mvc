import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PINS = {
  '@babel/code-frame': '^7.27.1',
  '@types/react': '~19.2.2',
  expo: '~57.0.9',
  react: '19.2.3',
  'react-native': '0.86.2',
  typescript: '~6.0.3'
};

const PACKAGES = ['mvc', 'react', 'router'];
const MARKER = '[gauntlet]';
const PLATFORM = process.argv[2] === 'android' ? 'android' : 'ios';
const RELEASE = process.argv.includes('release');

const workspace = await mkdtemp(join(tmpdir(), 'expressive-gauntlet-'));

const report = Promise.withResolvers<string[]>();
const lines: string[] = [];

let timeout: Timer;
let status = 0;

// The Xcode build goes minutes at a time without output, and a Release run
// reads the device log - where unrelated lines arrive meanwhile. Only the app
// reporting means the short idle applies.
let reporting = false;

const idle = (minutes: number) => {
  clearTimeout(timeout);
  timeout = setTimeout(
    () => report.reject(
      new Error(`${minutes} minutes of silence. See the log above.`)
    ),
    minutes * 60 * 1000
  );
};

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

  const udid = process.env.SIMULATOR_UDID;
  const ios = PLATFORM === 'ios';
  const device = ios && udid ? ['--device', udid] : [];
  const configuration = RELEASE
    ? ios ? ['--configuration', 'Release'] : ['--variant', 'release']
    : [];

  if (RELEASE && ios && !udid)
    throw new Error('A Release run needs SIMULATOR_UDID - its logs come from the device, not Metro.');

  if (RELEASE && !ios)
    await $`adb logcat -c`.nothrow().quiet();

  // Never 'inherit' - Metro and the Gradle daemon outlive the kill below, and
  // a copy of the caller's stdout would keep the CI step open past the verdict.
  const run = Bun.spawn(['npx', 'expo', `run:${PLATFORM}`, ...configuration, ...device], {
    cwd: workspace,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' }
  });

  const forward = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream)
      process.stdout.write(chunk);
  };

  forward(run.stderr as ReadableStream<Uint8Array>);

  if (RELEASE)
    forward(run.stdout as ReadableStream<Uint8Array>);

  // A Release build embeds the bundle, so the app's console never reaches Metro.
  const logs = RELEASE
    ? Bun.spawn(ios ? [
        'xcrun', 'simctl', 'spawn', udid!, 'log', 'stream',
        '--style', 'compact', '--predicate', 'process == "gauntlet"'
      ] : [
        'adb', 'logcat', '-s', 'ReactNativeJS:*'
      ], { stdout: 'pipe', stderr: 'ignore' })
    : run;

  const watch = async () => {
    let pending = '';

    for await (const chunk of logs.stdout as ReadableStream<Uint8Array>) {
      const text = pending + new TextDecoder().decode(chunk);
      const split = text.split('\n');

      pending = split.pop() || '';

      idle(reporting ? 5 : 30);

      for (const line of split) {
        console.log(line);

        const marked = line.indexOf(MARKER);

        if (marked < 0)
          continue;

        reporting = true;

        const result = line.slice(marked + MARKER.length).trim();

        if (result.startsWith('DONE'))
          report.resolve(lines);
        else
          lines.push(result);
      }
    }
  };

  idle(30);
  watch();

  // In Release the app is already installed and launched, so expo exiting is
  // expected; only silence is fatal.
  const results = await Promise.race([
    report.promise,
    run.exited.then(code => {
      // In Release the app is already installed and launched, so a clean exit
      // is expected - but a failed build still has to surface as one.
      if (code || !RELEASE)
        throw new Error(`expo run:${PLATFORM} exited with ${code} before the app reported.`);

      return report.promise;
    })
  ]);

  run.kill();

  if (logs !== run) logs.kill();

  const failed = results.filter(line => line.startsWith('FAIL'));

  console.log(`\n--- gauntlet on ${PLATFORM} ---`);

  for (const line of results)
    console.log(line);

  if (failed.length)
    throw new Error(`${failed.length} of ${results.length} checks failed on ${PLATFORM}.`);

  console.log(`\n${results.length} checks passed on ${PLATFORM}.`);
}
catch (thrown) {
  console.error(thrown);
  status = 1;
}
finally {
  clearTimeout(timeout);
  await rm(workspace, { recursive: true, force: true });
}

// expo leaves Metro and the platform tooling running, and those children would
// otherwise hold the process open past the verdict.
process.exit(status);
