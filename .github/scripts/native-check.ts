import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Pack every publishable package, install the tarballs into a throwaway Expo
 * app outside the repo, and put the result through React Native's toolchain -
 * the sibling of `dist-smoke.ts`, which does the same for Node ESM. Neither
 * vitest nor a bundler-agnostic check can see these: Metro reads its own
 * condition set, and Hermes is a different engine from the one tests run on.
 *
 * Runs from `ci:publish`, so it gates the publish rather than every merge.
 */
const PINS = {
  expo: '~57.0.9',
  react: '19.2.3',
  'react-native': '0.86.2'
};

const PACKAGES = ['mvc', 'react', 'router'];

const SUBPATHS = [
  '@expressive/mvc',
  '@expressive/mvc/runtime',
  '@expressive/mvc/observable',
  '@expressive/react',
  '@expressive/react/adapter',
  '@expressive/router'
];

const ENTRY = `
import { registerRootComponent } from 'expo';
import { Text } from 'react-native';
${SUBPATHS.map((from, i) => `import * as m${i} from '${from}';`).join('\n')}

const loaded = [${SUBPATHS.map((_, i) => `m${i}`).join(', ')}].map(Object.keys);

registerRootComponent(() => <Text>{JSON.stringify(loaded)}</Text>);
`;

const FIELDS = `
import State, { set } from '@expressive/mvc';

export class Subject extends State {
  count = 0;
  label = set('untitled');
  nested = { deep: true };

  get doubled() { return this.count * 2 }
}
`;

const EXERCISE = (Subject: any) => {
  const subject = Subject.new();
  const before = [subject.count, subject.label, subject.doubled, subject.nested.deep];

  subject.count = 21;

  return JSON.stringify([...before, subject.doubled, Object.keys(subject.nested)]);
};

const workspace = await mkdtemp(join(tmpdir(), 'expressive-native-'));
const results: string[] = [];

try {
  await Bun.write(join(workspace, 'package.json'), JSON.stringify({
    name: 'native-check',
    version: '1.0.0',
    main: 'index.jsx',
    private: true,
    dependencies: PINS
  }));

  await Bun.write(join(workspace, 'app.json'), JSON.stringify({
    expo: { name: 'native-check', slug: 'native-check', platforms: ['ios', 'android'] }
  }));

  await Bun.write(join(workspace, 'index.jsx'), ENTRY);
  await Bun.write(join(workspace, 'fields.js'), FIELDS);

  await $`npm install --silent --no-audit --no-fund`.cwd(workspace).quiet();

  const tarballs: string[] = [];

  for (const name of PACKAGES) {
    const packed = await $`npm pack --silent --pack-destination ${workspace}`
      .cwd(`packages/${name}`).text();

    tarballs.push(join(workspace, packed.trim()));
  }

  await $`npm install --silent --no-audit --no-fund ${tarballs}`.cwd(workspace).quiet();

  // 1 - Metro resolves every published subpath, for both native platforms.

  await $`npx expo export --platform ios --platform android --source-maps --output-dir out`
    .cwd(workspace).quiet();

  for (const platform of ['ios', 'android']) {
    const maps = new Bun.Glob(`out/_expo/static/js/${platform}/*.map`);
    let sources: string[] = [];

    for await (const path of maps.scan({ cwd: workspace }))
      sources = sources.concat(JSON.parse(await Bun.file(join(workspace, path)).text()).sources);

    if (!sources.length)
      throw new Error(`No ${platform} source map emitted by expo export.`);

    for (const from of SUBPATHS) {
      const [, scope, entry = 'index'] = /^@expressive\/(\w+)(?:\/(\w+))?$/.exec(from)!;
      const module = `@expressive/${scope}/dist/${entry}.js`;

      if (!sources.some(source => source.endsWith(module)))
        throw new Error(`${from} did not reach the ${platform} bundle as ${module}.`);
    }

    if (sources.some(source => /node_modules\/react-dom\//.test(source)))
      throw new Error(`react-dom reached the ${platform} bundle.`);

    results.push(`${platform}: ${sources.length} modules, all ${SUBPATHS.length} subpaths resolved, no react-dom`);
  }

  // 2 - Hermes accepts the bundle. Compiles to bytecode; does not execute it.

  const bundles = new Bun.Glob('out/_expo/static/js/ios/*.hbc');
  let compiled = 0;

  for await (const path of bundles.scan({ cwd: workspace })) {
    const bytes = await Bun.file(join(workspace, path)).bytes();
    const view = new DataView(bytes.buffer);

    if (view.getBigUint64(0, true) !== 0x1f1903c103bc1fc6n)
      throw new Error(`${path} carries no Hermes bytecode header.`);

    results.push(`hermes: bytecode version ${view.getUint32(8, true)}, ${bytes.length} bytes`);
    compiled++;
  }

  if (!compiled)
    throw new Error('expo export emitted no Hermes bytecode for ios.');

  // 3 - A State subclass behaves the same whichever way Metro compiles its
  // fields. Declaring engine 'hermes' keeps native fields ([[Define]]); every
  // other target, jsEngine 'jsc' included, downlevels them to assignment.

  const require = createRequire(join(workspace, 'node_modules/expo/package.json'));
  const babel = require('@babel/core');
  const observed: Record<string, string> = {};

  for (const engine of ['hermes', undefined]) {
    const target = engine || 'jsc';

    const { code } = babel.transformFileSync(join(workspace, 'fields.js'), {
      cwd: workspace,
      configFile: false,
      babelrc: false,
      presets: [require.resolve('babel-preset-expo')],
      caller: { name: 'metro', platform: 'ios', isDev: false, engine, supportsStaticESM: false }
    }) as { code: string };

    const native = !/this\.count\s*=/.test(code);

    if (native !== (target === 'hermes'))
      throw new Error(`${target} compiled fields to ${native ? 'native fields' : 'assignment'}.`);

    await Bun.write(join(workspace, `fields.${target}.cjs`), code);
    observed[target] = EXERCISE(require(join(workspace, `fields.${target}.cjs`)).Subject);
  }

  if (observed.hermes !== observed.jsc)
    throw new Error(`Field semantics diverge: hermes ${observed.hermes}, jsc ${observed.jsc}`);

  results.push(`babel: identical behavior from native fields and assignment - ${observed.hermes}`);
}
catch (error) {
  console.error(`Fixture kept for inspection: ${workspace}`);
  throw error;
}

await rm(workspace, { recursive: true, force: true });

console.log(results.join('\n'));
