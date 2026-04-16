import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home/index.tsx"),
  route("docs/*", "routes/docs.tsx"),
  route("examples/:name?", "routes/example.tsx"),
  route("api/search", "routes/search.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
