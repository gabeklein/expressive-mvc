import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home/index.tsx"),
  route("docs/*", "routes/docs.tsx"),
  route("examples", "routes/examples/layout.tsx", [
    index("routes/examples/view.tsx"),
    route("*", "routes/examples/view.tsx", { id: "example-view" }),
  ]),
  route("api/search", "routes/search.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
