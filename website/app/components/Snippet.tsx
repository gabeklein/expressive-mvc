import { DynamicCodeBlock, type DynamicCodeblockProps } from 'fumadocs-ui/components/dynamic-codeblock';

type SnippetProps = Partial<Omit<DynamicCodeblockProps, 'code'>> & {
  highlight?: { prefix: string; targets: Record<string, RegExp> };
};

export default function code(strings: TemplateStringsArray, ...values: unknown[]) {
  const code = dedent(String.raw({ raw: strings }, ...values));
  return ({ highlight, ...props }: SnippetProps = {}) => {
    const decorations = highlight && Object.entries(highlight.targets).flatMap(([name, pattern]) => {
      for (const [line, source] of code.split('\n').entries()) {
        pattern.lastIndex = 0;
        const match = pattern.exec(source);
        if (match?.index === undefined) continue;
        return [{
          alwaysWrap: true,
          start: { line, character: match.index },
          end: { line, character: match.index + match[0].length },
          properties: { class: `${highlight.prefix}-${name}` },
        }];
      }
      return [];
    });

    return (
      <DynamicCodeBlock
        lang="tsx"
        code={code}
        {...props}
        options={{
          ...props.options,
          decorations: [
            ...(props.options?.decorations ?? []),
            ...(decorations || []),
          ],
        }}
      />
    );
  };
}

function dedent(s: string) {
  const lines = s.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
  const nonBlank = lines.filter(l => l.trim());
  const indent = nonBlank.length
    ? Math.min(...nonBlank.map(l => l.match(/^ */)![0].length))
    : 0;
  return lines.map(l => l.slice(indent)).join('\n');
}
