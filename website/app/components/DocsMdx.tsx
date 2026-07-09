import type { ComponentProps } from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';

function ScrollTable(props: ComponentProps<'table'>) {
  return (
    <div className="docs-scroll-frame prose-no-margin relative my-6">
      <div className="docs-scroll-content">
        <table {...props} />
      </div>
    </div>
  );
}

const docsMdxComponents = {
  ...defaultMdxComponents,
  table: ScrollTable,
};

export default docsMdxComponents;
