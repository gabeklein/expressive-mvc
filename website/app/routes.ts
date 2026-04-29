import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home/index.tsx"),
  route("docs/*", "routes/docs.tsx"),
  route("examples", "routes/examples/layout.tsx", [
    route(":name?", "routes/examples/view.tsx"),
  ]),
  route("api/search", "routes/search.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
