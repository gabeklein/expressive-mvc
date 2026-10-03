import { State } from "@expressive/mvc";

export default class Blog extends State {
  posts = ["hello", "world"];
}

export function Page() {
  const { posts } = Blog.get();

  return (
    <>
      <h1>Blog index</h1>
      <ul>
        {posts.map(post => <li key={post}>{post}</li>)}
      </ul>
    </>
  );
}
