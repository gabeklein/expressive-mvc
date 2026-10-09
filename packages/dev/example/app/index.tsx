import { State, type Component } from "@expressive/mvc";
import { Link } from "@expressive/dev";

class Counter extends State {
  count = 0;
}

export function Layout(props: { children?: Component.Node }) {
  return (
    <main>
      <nav>
        <Link to="/">Home</Link> {" | "}
        <Link to="/blog">Blog</Link> {" | "}
        <Link to="/blog/hello">Hello post</Link> {" | "}
        <Link to="/about">About</Link> {" | "}
        <Link to="/tally">Tally</Link>
      </nav>
      {props.children}
    </main>
  );
}

export function Page() {
  const { count, is } = Counter.use();

  return (
    <>
      <h1>Home</h1>
      <button onClick={() => is.count++}>Clicked {count} times</button>
    </>
  );
}

export function Loading() {
  return <p>Loading…</p>;
}

export function NotFound() {
  return <h1>404</h1>;
}

export function Catch({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <p role="alert">
      Something broke: {error.message} <button onClick={retry}>Retry</button>
    </p>
  );
}
