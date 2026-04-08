import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.jsx'),
  route('docs/*', 'routes/docs.tsx'),
  route('examples/:name?', 'routes/example.jsx'),
  route('api/search', 'routes/search.ts'),
  route('*', 'routes/not-found.jsx')
] satisfies RouteConfig;
