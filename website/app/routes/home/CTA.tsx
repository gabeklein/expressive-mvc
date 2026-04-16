import { Link } from 'react-router';

export function CTA() {
  inner: {
    margin: 0, auto;
    maxWidth: 768;
    padding: 96, 24;
    textAlign: center;
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
    marginBottom: 40;
  }

  actions: {
    display: flex;
    flexDirection: column;
    gap: 12;
    justifyContent: center;
    $sm: { flexDirection: row; }

    Link: {
      display: inlineFlex;
      alignItems: center;
      justifyContent: center;
      borderRadius: 999;
      fontWeight: 500;
      padding: 12, 24;
      textDecoration: none;
      transition: `opacity 0.2s, background-color 0.2s`;
    }

    primary: {
      background: $colorFdPrimary;
      color: $colorFdPrimaryForeground;
      $hover: { opacity: 0.9; }
    }

    secondary: {
      border: $colorFdBorder;
      color: inherit;
      $hover: { background: $colorFdMuted; }
    }
  }

  return (
    <section>
      <div _inner>
        <h2 _title>Ready to move state out of components?</h2>
        <p _desc>
          Start with one feature. Leave everything else alone. See how it feels.
        </p>
        <div _actions>
          <Link _primary to="/docs/getting-started">
            Getting Started
          </Link>
          <Link _secondary to="/docs/migrating-from-hooks">
            Migration Guide
          </Link>
          <Link _secondary to="/docs/comparisons">
            Compare
          </Link>
        </div>
      </div>
    </section>
  );
}
