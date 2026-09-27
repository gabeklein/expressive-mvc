import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] => readdirSync(d).flatMap(f => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

for (const file of [...walk('pages-dom'), ...walk('common-dom')]) {
  if (!/\.tsx?$/.test(file)) continue;
  let src = readFileSync(file, 'utf8');
  const orig = src;
  src = src.replace(/import\s+\{([^}]*)\}\s+from\s+['"]@expressive\/react['"];?/g, (_, names: string) => {
    const list = names.split(',').map(s => s.trim()).filter(Boolean);
    const dom = list.filter(n => /^(type\s+)?(Provider|Consumer)\b/.test(n));
    const mvc = list.filter(n => !dom.includes(n));
    return [
      mvc.length && `import { ${mvc.join(', ')} } from '@expressive/mvc';`,
      dom.length && `import { ${dom.join(', ')} } from '@expressive/dom';`
    ].filter(Boolean).join('\n');
  });
  src = src.replace(/'@common\//g, "'@common-dom/");
  src = src.replace(/\bclassName=/g, 'class=');
  src = src.replace(/\bReactNode\b/g, 'Component.Node');
  if (file.endsWith('.tsx') && !src.includes('@jsxImportSource'))
    src = `/** @jsxImportSource @expressive/dom */\n` + src;
  if (src !== orig) writeFileSync(file, src);
}
