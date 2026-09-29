import { Route } from "@expressive/dev";

export class Page extends Route {
  render() {
    return <h1>Post: {this.match!.slug}</h1>;
  }
}
