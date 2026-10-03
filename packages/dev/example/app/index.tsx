import { State, set, type Component } from "@expressive/mvc";
import { Link } from "@expressive/dev";

import { hello } from "./api/greetings";

class Greeting extends State {
  message = set(() => hello("Expressive"));
}

export function Layout(props: { children?: Component.Node }) {
  return (
    <main>
      <nav>
        <Link to="/">Home</Link> {" | "}
        <Link to="/blog">Blog</Link> {" | "}
        <Link to="/blog/hello">Hello post</Link> {" | "}
        <Link to="/admin">Admin</Link>
      </nav>
      {props.children}
    </main>
  );
}

export function Page() {
  const { message } = Greeting.use();

  return (
    <>
      <h1>Home</h1>
      <p data-greeting>{message}</p>
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
