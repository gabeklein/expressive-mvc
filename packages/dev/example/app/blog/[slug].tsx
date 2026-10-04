import { Route } from "@expressive/dev";

import { POSTS } from "./index";

export class Page extends Route {
  render() {
    const slug = this.match?.slug;
    const known = POSTS.includes(slug!);

    return <h1>Post: {slug}{known ? "" : " (draft)"}</h1>;
  }
}
