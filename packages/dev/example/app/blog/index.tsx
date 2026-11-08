import { Model } from "@expressive/mvc";

export default class Blog extends Model {
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
