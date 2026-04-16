import { Link } from 'react-router';

export function Hero() {
  borderBottom: `1px solid`;
  borderColor: $colorFdBorder;
  boxSizing: borderBox;
  height: `calc(100vh - 56px)`;
  display: flex;
  alignItems: center;
  justifyContent: center;

  inner: {
    margin: 0, auto;
    maxWidth: 1024;
    padding: 96, 24;
    textAlign: center;
    $md: {
      padding: 128, 24;
    }
  }

  badge: {
    display: inlineBlock;
    marginBottom: 24;
    fontSize: 0.75;
    textTransform: uppercase;
    letterSpacing: '0.1em';
    color: $colorFdMutedForeground;
  }

  heading: {
    fontSize: 3.0;
    fontFamily: Rubik;
    fontWeight: 300;
    maxWidth: 10.0;
    margin: 0, auto;
    fontWeight: bold;
    letterSpacing: '-0.025em';
    lineHeight: 1.2;
    marginBottom: 24;
    $md: { fontSize: 4.5; }

    accent: {
      color: $colorFdPrimary;
    }
  }

  subtitle: {
    fontSize: 1.125;
    color: $colorFdMutedForeground;
    maxWidth: 672;
    margin: 0, auto;
    marginBottom: 40;
    $md: { fontSize: 1.25; }
  }

  install: {
    marginTop: 48;
    display: "inline-block";
    fontFamily: monospace;
    fontSize: 0.875, rem;
    background: $colorFdMuted;
    padding: 12, 20;
    borderRadius: 8;
    color: $colorFdMutedForeground;
  }

  return (
    <section>
      <div _inner>
        <div _badge>State management, reorganized</div>
        <h1 _heading>
          What if state had it's own Components?
        </h1>
        <p _subtitle>
          Expressive State consolidates your application state into
          plain classes. No reducers, no selectors, no dependency arrays. Just
          data, behavior, and lifecycle in one place.
        </p>
        <HeroNavigation />
        <div _install>npm install @expressive/react</div>
      </div>
    </section>
  );
}

function HeroNavigation(){
  display: flex;
  flexDirection: column;
  gap: 12;
  justifyContent: center;
  $sm: { flexDirection: row; }

  Link: {
    display: "inline-flex";
    alignItems: center;
    justifyContent: center;
    radius: round;
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

  return (
    <div>
      <Link _primary to="/docs/getting-started">
        Get Started
      </Link>
      <Link _secondary to="/docs/why-classes">
        Why Classes?
      </Link>
    </div>
  );
}
