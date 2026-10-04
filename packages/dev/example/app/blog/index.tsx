export const POSTS = ["hello", "world"];

export function Page() {
  return (
    <>
      <h1>Blog index</h1>
      <ul>
        {POSTS.map(post => <li key={post}>{post}</li>)}
      </ul>
    </>
  );
}
