import { DynamicCodeBlock, type DynamicCodeblockProps } from 'fumadocs-ui/components/dynamic-codeblock';

type Override = Partial<Omit<DynamicCodeblockProps, 'code'>>;

export default function code(strings: TemplateStringsArray, ...values: unknown[]) {
  const code = dedent(String.raw({ raw: strings }, ...values));
  return (props?: Override) => (
    <DynamicCodeBlock lang="tsx" code={code} {...props} />
  );
}

function dedent(s: string) {
  const lines = s.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
  const nonBlank = lines.filter(l => l.trim());
  const indent = nonBlank.length
    ? Math.min(...nonBlank.map(l => l.match(/^ */)![0].length))
    : 0;
  return lines.map(l => l.slice(indent)).join('\n');
}
