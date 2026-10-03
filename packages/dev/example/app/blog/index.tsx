import { State, set } from "@expressive/mvc";

import { list } from "./api";

export default class Blog extends State {
  posts = set(() => list());
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
