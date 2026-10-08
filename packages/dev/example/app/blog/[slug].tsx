import { Route } from "@expressive/dev";
import { get } from "@expressive/mvc";

import Blog from "./index";

export class Page extends Route {
  blog = get(Blog);

  render() {
    const slug = this.match?.slug;
    const known = this.blog.posts.includes(slug!);

    return <h1>Post: {slug}{known ? "" : " (draft)"}</h1>;
  }
}
