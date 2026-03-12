export const Features = () => {
  padding: 60, 20;
  maxWidth: 1200;
  margin: 0, auto;

  heading: {
    fontSize: 2.5;
    fontWeight: bold;
    textAlign: center;
    marginBottom: 10;
  }

  subheading: {
    fontSize: 1.2;
    color: 0x666;
    textAlign: center;

    if ('.dark') {
      color: 0x999;
    }
  }

  grid: {
    display: grid;
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))';
    gap: 30;
    marginTop: 40;
  }

  return (
    <section>
      <h2 _heading>Why Expressive JSX?</h2>
      <p _subheading>
        A styling solution that feels like JavaScript because it is JavaScript
      </p>
      <div _grid>
        <Feature
          icon="🎨"
          title="Natural Syntax"
          description="Write styles using familiar JavaScript. Labels, identifiers, and conditionals become CSS—no new syntax to learn."
        />
        <Feature
          icon="⚡️"
          title="Zero Runtime"
          description="All transformations happen at build time. Extract CSS to separate files with no performance overhead."
        />
        <Feature
          icon="🔧"
          title="Type-Safe"
          description="Full TypeScript support with intelligent autocomplete for properties and values."
        />
        <Feature
          icon="🎯"
          title="No Wrappers"
          description="Style components directly without wrapper functions. Return regular JSX elements, not styled('div')."
        />
        <Feature
          icon="🚀"
          title="Macro System"
          description="User-definable macros let you create custom shorthand for your design system."
        />
        <Feature
          icon="🌙"
          title="Framework Agnostic"
          description="Works with Vite, Next.js, Webpack, Rollup, and Parcel. Use it anywhere Babel runs."
        />
      </div>
    </section>
  );
};

const Feature = ({ icon, title, description }) => {
  padding: 30;
  borderRadius: 12;
  border: 0xe5e5e5;
  transition: 'all 0.3s ease';

  if (':hover') {
      transform: 'translateY(-4px)';
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)';
  }

  icon: {
    fontSize: 2.5;
    marginBottom: 15;
  }

  title: {
    fontSize: 1.5;
    fontWeight: bold;
    marginBottom: 10;
    color: 0x8150ce;
  }

  description: {
    fontSize: 1;
    color: 0x666;
    lineHeight: 1.6;
  }

  return (
    <div _card>
      <div _icon>{icon}</div>
      <h3 _title>{title}</h3>
      <p _description>{description}</p>
    </div>
  );
};
