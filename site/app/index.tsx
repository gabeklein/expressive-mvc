import { Redirect } from "@expressive/dev";

import { style } from "./style";

export function Page() {
  return <Redirect to="/docs" />;
}

export function NotFound() {
  return <h1>Not found</h1>;
}

style(NotFound);
