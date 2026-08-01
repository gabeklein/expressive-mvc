import { Component, ref } from '@expressive/react';
import { DynamicCodeBlock, type DynamicCodeblockProps } from 'fumadocs-ui/components/dynamic-codeblock';
import type { ReactNode } from 'react';

type SnippetProps = Partial<Omit<DynamicCodeblockProps, 'code'>> & {
  highlight?: { prefix: string; targets: Record<string, RegExp> };
};

export default function code(strings: TemplateStringsArray, ...values: unknown[]) {
  const code = dedent(String.raw({ raw: strings }, ...values));
  const Snippet = ({ highlight, ...props }: SnippetProps = {}) => {
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
      <SnippetEntrance>
        <DynamicCodeBlock
          lang="tsx"
          code={code}
          {...props}
          options={{
            themes: { light: 'github-light', dark: 'github-dark' },
            ...props.options,
            decorations: [
              ...(props.options?.decorations ?? []),
              ...(decorations || []),
            ],
          } as SnippetProps['options']}
        />
      </SnippetEntrance>
    );
  };

  return Object.assign(Snippet, { tokenCount: Math.round(code.length / 4) });
}

class SnippetEntrance extends Component {
  root = ref<HTMLDivElement>((element) => {
    let timeout = 0;
    const highlighted = () => element.querySelector('[style*="--shiki-light"]');
    const reveal = () => {
      element.dataset.visible = '';
      observer.disconnect();
      window.clearTimeout(timeout);
    };
    const observer = new MutationObserver(() => {
      if (highlighted()) reveal();
    });

    observer.observe(element, { childList: true, subtree: true });
    timeout = window.setTimeout(reveal, 1750);
    if (highlighted()) reveal();

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  });

  render({ children } = {} as { children: ReactNode }) {
    return <div ref={this.root} className="snippet-entrance">{children}</div>;
  }
}

function dedent(s: string) {
  const lines = s.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
  const nonBlank = lines.filter(l => l.trim());
  const indent = nonBlank.length
    ? Math.min(...nonBlank.map(l => l.match(/^ */)![0].length))
    : 0;
  return lines.map(l => l.slice(indent)).join('\n');
}
