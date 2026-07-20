import { Glob } from 'bun';

let lf = 0, lh = 0;
let keep = false;

for await (const path of new Glob('packages/*/coverage/lcov.info').scan('.')) {
  for (const line of (await Bun.file(path).text()).split('\n')) {
    const [key, value] = line.split(':');

    if (key === 'SF') keep = value.startsWith('src/');
    else if (!keep) continue;
    else if (key === 'LF') lf += +value;
    else if (key === 'LH') lh += +value;
  }
}

if (!lf)
  throw new Error('No coverage data found in packages/*/coverage/lcov.info.');

const pct = Math.floor((lh / lf) * 1000) / 10;
const color =
  pct >= 100 ? 'brightgreen' :
  pct >= 90 ? 'green' :
  pct >= 80 ? 'yellowgreen' :
  pct >= 60 ? 'yellow' : 'red';

await Bun.write('coverage-badge.json', JSON.stringify({
  schemaVersion: 1,
  label: 'coverage',
  message: `${pct}%`,
  color
}));

console.log(`lines ${lh}/${lf} -> ${pct}% (${color})`);
