import React from 'react';

export function Benefits() {
  borderBottom: currentColor;
  borderColor: $colorFdBorder;

  inner: {
    margin: 0, auto;
    maxWidth: $contentWidth;
    padding: 96, 24;
  }

  header: {
    maxWidth: 672;
    marginBottom: 64;

    label: {
      fontSize: 0.75;
      textTransform: uppercase;
      letterSpacing: '0.1em';
      color: $colorFdMutedForeground;
      marginBottom: 12;
    }

    title: {
      fontSize: 1.875;
      fontWeight: bold;
      marginBottom: 16;
      $md: { fontSize: 2.25; }
    }

    desc: {
      color: $colorFdMutedForeground;
      fontSize: 1.125;
    }
  }

  grid: {
    display: grid;
    gridTemplateColumns: '1fr';
    gap: 32;
    $md: { gridTemplateColumns: '1fr 1fr'; }
  }

  return (
    <section>
      <div _inner>
        <div _header>
          <div _label>What you get</div>
          <h2 _title>A state backbone for your application.</h2>
          <p _desc>
            Expressive is designed to be the place where data, behavior, and
            lifecycle live - so components can go back to doing what they do
            best: describing UI.
          </p>
        </div>
        <div _grid>
          <Benefit title="Cohesive by default">
            Related state, derived values, lifecycle, and behavior all live in
            one place. Open a class, read it top-to-bottom, understand the feature.
          </Benefit>
          <Benefit title="No dependency arrays">
            Computed values and effects track what they read automatically.
            Forgetting a dependency is impossible - you would have to read a
            value without accessing it.
          </Benefit>
          <Benefit title="Testable without rendering">
            State classes are plain objects. Create with .new(), call methods,
            assert properties. No @testing-library, no act(), no DOM.
          </Benefit>
          <Benefit title="Async is built in">
            Async factories integrate with Suspense. Required placeholders
            suspend until resolved. No query library, no middleware, no thunks.
          </Benefit>
          <Benefit title="Type-safe context">
            The class is the context key. No createContext&lt;T&gt;, no default
            values, no manual Provider/Consumer pairs. Full inference automatically.
          </Benefit>
          <Benefit title="Coexists with hooks">
            No big-bang rewrite. Migrate one feature at a time. Leave simple
            useState calls alone. Expressive is a tool for complexity, not a
            replacement for hooks.
          </Benefit>
          <Benefit title="Refactor-friendly">
            Rename a field and TypeScript catches every usage. The class is the
            type. Go-to-definition, find-references, and outline views all work
            exactly as you expect.
          </Benefit>
          <Benefit title="AI and human readable">
            Classes are self-contained units with explicit shapes. A reviewer -
            human or AI - can load a feature into memory without chasing hooks
            across files.
          </Benefit>
        </div>
      </div>
    </section>
  );
}

interface BenefitProps {
  title: string;
  children: React.ReactNode;
}

function Benefit({ title, children }: BenefitProps) {
  borderLeft: $colorFdPrimary, 2;
  paddingLeft: 20;

  h3: {
    fontSize: 1.125;
    fontWeight: 600;
    marginBottom: 8;
  }

  p: {
    color: $colorFdMutedForeground;
    lineHeight: 1.625;
  }

  return (
    <div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
