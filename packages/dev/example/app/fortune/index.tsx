import { Fortune } from "./remote";

function Reading() {
  const { text } = Fortune.use();

  return <p>{text}</p>;
}

export function Page() {
  return (
    <>
      <h1>Fortune</h1>
      <Reading />
    </>
  );
}
