import { Glob } from 'bun';

const totals = { LF: 0, LH: 0, FNF: 0, FNH: 0, BRF: 0, BRH: 0 };
let keep = false;

for await (const path of new Glob('packages/*/coverage/lcov.info').scan('.')) {
  for (const line of (await Bun.file(path).text()).split('\n')) {
    const [key, value] = line.split(':');

    if (key === 'SF') keep = value.startsWith('src/');
    else if (keep && key in totals) totals[key as keyof typeof totals] += +value;
  }
}

if (!totals.LF || !totals.FNF || !totals.BRF)
  throw new Error('Missing line, function, or branch data in packages/*/coverage/lcov.info.');

const ratio = Math.min(
  totals.LH / totals.LF,
  totals.FNH / totals.FNF,
  totals.BRH / totals.BRF
);
const pct = Math.floor(ratio * 1000) / 10;
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

console.log(
  `lines ${totals.LH}/${totals.LF}, functions ${totals.FNH}/${totals.FNF}, ` +
  `branches ${totals.BRH}/${totals.BRF} -> ${pct}% (${color})`
);
