import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Browser, CHROME, until } from './chrome';

const target = join(import.meta.dir, '../../packages/dom/src/style/numeric.ts');
const ambiguous = ['animation', 'webkitAnimation'];
const check = process.argv.includes('--check');

if (!await Bun.file(CHROME).exists()) {
  console.log(`No Chrome at ${CHROME} - set CHROME to regenerate numeric.ts.`);
  process.exit(check ? 0 : 1);
}

function probe(ambiguous: string[]) {
  const style = document.createElement('div').style as unknown as Record<string, string>;
  const keys = new Set<string>();
  const tables = { numeric: [] as string[], unitless: [] as string[], single: [] as string[] };
  const valid = (key: string, value: unknown) => {
    style[key] = '';
    style[key] = value as string;
    return style[key] !== '';
  };

  for (let proto = style; proto; proto = Object.getPrototypeOf(proto))
    for (const key of Object.getOwnPropertyNames(proto))
      if (/^[a-z][a-zA-Z]*$/.test(key) && typeof style[key] == 'string' && key != 'cssText')
        keys.add(key);

  for (const key of [...keys].sort()) {
    if (ambiguous.includes(key)) continue;

    const bare = valid(key, 1);
    const sized = ['1px', '1px 1px', '1px 1px 1px', '1px serif'].some((value) => valid(key, value));
    const mixed = ['1 1px', '1px 1', '1 1 1px', '1 1px serif', '1 1px 1px', '1px 1 1', '1px 1px 1'].some((value) => valid(key, value));

    if (mixed && !bare) continue;

    if (mixed && !valid(key, '1 1 1')) tables.single.push(key);
    else {
      if (bare) tables.unitless.push(key);
      if (bare || sized) tables.numeric.push(key);
    }
  }

  return tables;
}

const server = Bun.serve({
  port: 0,
  fetch: () =>
    new Response(
      `<!doctype html><html><body><pre id="out"></pre><script>` +
      `document.getElementById('out').textContent = JSON.stringify((${probe})(${JSON.stringify(ambiguous)}));` +
      `</script></body></html>`,
      { headers: { 'content-type': 'text/html' } }
    )
});

const profile = mkdtempSync(join(tmpdir(), 'numeric-properties-'));
const browser = new Browser();
let out: string | null = null;

try {
  await browser.open(`http://localhost:${server.port}/`, profile);
  out = await until(() => browser.text('#out'), 10000);
} finally {
  await browser.close();
  server.stop(true);
  rmSync(profile, { recursive: true, force: true });
}

const { numeric, unitless, single } = JSON.parse(out!) as Record<string, string[]>;

const union = (doc: string, name: string, names: string[]) =>
  [`/** ${doc} */`, `type ${name} =`, ...names.map((key, index) => `  | '${key}'${index == names.length - 1 ? ';' : ''}`), ''];

const source = [
  `// Generated from Chrome by .github/scripts/numeric-properties.ts - rerun it rather than editing.`,
  ``,
  ...union('Properties where a number is valid CSS once `Css` gives it px.', 'Numeric', numeric),
  ...union('Properties where a bare number is valid CSS.', 'Unitless', unitless),
  ...union('Properties where a lone number is valid but a number inside a sequence is not.', 'Single', single),
  `export type { Numeric, Single, Unitless };`,
  ``
].join('\n');

if (check) {
  const current = readFileSync(target, 'utf8');

  if (current != source) {
    console.log(`::warning file=packages/dom/src/style/numeric.ts::numeric.ts differs from Chrome ${await Bun.$`${CHROME} --version`.text()} - rerun .github/scripts/numeric-properties.ts.`);
    process.exit(1);
  }

  console.log('numeric.ts matches Chrome.');
} else {
  writeFileSync(target, source);
  console.log(`Wrote ${numeric.length} numeric, ${unitless.length} unitless and ${single.length} single-number properties.`);
}
