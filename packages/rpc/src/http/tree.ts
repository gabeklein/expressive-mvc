import type { Endpoint, Exports, Seats } from "../call";
import { headersOf, within, type Params, type Seat } from "../context";
import { METHODS, rank, unbased } from "../segments";
import { dispatch, failure, isCall, withHeaders } from "./call";

export { METHODS };

/** A route module's handler: the request, and the route's `[param]` values by name. */
export type Method = (request: Request, params: Params) => Response | Promise<Response>;

type Load<T> = () => Promise<T>;

/**
 * One folder of the calls' `dir`, as the server routes it. Its children are keyed as the URL meets them:
 * a static name, `:name` for `[name]`, or `*` for `[...]`.
 */
export interface Node {
  /** The folder's gate - its index's default - seated before anything under it runs. */
  gate?: Load<Seat | undefined>;
  /** The calls of the folder's modules, answered at the folder's path. */
  calls?: Load<Exports>;
  /** The folder's index, when it exports methods: the route at the folder's own path. */
  index?: Load<Record<string, unknown>>;
  /** A module named for this segment, when it exports methods: a route behind its parent's gates, not this folder's. */
  file?: Load<Record<string, unknown>>;
  children?: Record<string, Node>;
}

export interface RouterOptions {
  dev?: boolean;
  /** The path the tree is served under - `"/api"` answers `api/todos.ts` at `/api/todos`. */
  base?: string;
}

interface Found {
  /** The nodes whose gates the route runs behind, root first. */
  trail: Node[];
  pattern: string[];
  segments: string[];
  load: Load<Record<string, unknown>>;
}

const order = (children: Record<string, Node> = {}) =>
  Object.entries(children).sort(([a], [b]) => rank(b) - rank(a));

/**
 * The route for `at` under `node`: static segments first, then a `[param]`, then a `[...]` - backing off when a
 * branch ends short. A `[...]` takes the rest of the path, none included, unless its folder's `(index)` answers there.
 */
export function find(node: Node, at: string[], trail: Node[] = [], pattern: string[] = []): Found | undefined {
  const along = [...trail, node];
  const i = pattern.length;

  if (i === at.length) {
    if (node.index) return { trail: along, pattern, segments: at, load: node.index };

    const rest = node.children?.["*"]?.file;

    return rest && { trail: along, pattern: [...pattern, "*"], segments: [...at, ""], load: rest };
  }

  for (const [key, child] of order(node.children)) {
    const here = [...pattern, key];

    if (key === "*") {
      const segments = [...at.slice(0, i), at.slice(i).join("/")];

      if (child.file) return { trail: along, pattern: here, segments, load: child.file };

      continue;
    }

    if (rank(key) === 2 && key !== at[i]) continue;
    if (i + 1 === at.length && child.file) return { trail: along, pattern: here, segments: at, load: child.file };

    const deeper = find(child, at, along, here);

    if (deeper) return deeper;
  }
}

/** The calls' endpoints, one per folder with calls. */
export function endpoints(node: Node, pattern: string[] = []): Endpoint[] {
  const own: Endpoint[] = node.calls ? [{ pattern, exports: node.calls }] : [];

  return [...own, ...order(node.children).flatMap(([key, child]) => endpoints(child, [...pattern, key]))];
}

/** The gate of the folder at `pattern`, for the calls - whose folders are static. */
export function gates(root: Node): Seats {
  return async pattern => {
    let node: Node | undefined = root;

    for (const part of pattern) node = node?.children?.[part];

    return node?.gate?.();
  };
}

function paramsOf(pattern: string[], segments: string[]): Params {
  const params: Record<string, string> = {};

  pattern.forEach((part, i) => {
    if (part === "*") params["*"] = segments[i];
    else if (part.startsWith(":")) params[part.slice(1)] = segments[i];
  });

  return params;
}

/**
 * The `api/` tree as a server: a call goes to its folder's calls; any other request to the route
 * its path names, which runs behind the gates of the folders along it. Anything else is `undefined`.
 */
export function router(root: Node | (() => Node | Promise<Node>), { dev = false, base = "" }: RouterOptions = {}): (request: Request) => Promise<Response | undefined> {
  const tree = typeof root == "function" ? root : () => root;

  return async request => {
    const path = unbased(new URL(request.url).pathname, base);

    if (path === undefined) return;

    let node: Node;

    try {
      node = await tree();
    } catch (error) {
      return failure(error, [], dev);
    }

    const list = endpoints(node);

    if (isCall(request)) return dispatch(request, () => list, dev, gates(node), undefined, base);

    const at = path.split("/").filter(Boolean).map(decodeURIComponent);
    const found = find(node, at);

    return found && answer(request, found, list, dev);
  };
}

async function answer(request: Request, { trail, pattern, segments, load }: Found, list: Endpoint[], dev: boolean): Promise<Response> {
  const module = await load();
  const exported = METHODS.filter(name => module[name] !== undefined);
  const name = request.method === "HEAD" && !exported.includes("HEAD") ? "GET" : request.method;

  if (!exported.includes(name)) return new Response(null, { status: 405, headers: { allow: exported.join(", ") } });

  const method = module[name] as Method;
  const params = paramsOf(pattern, segments);
  const route = `${name} /${pattern.join("/")}`;

  try {
    if (typeof method != "function") throw new Error(`${route} is ${typeof method}, not a function - a route answers ${name} requests with one.`);

    const seats = await Promise.all(trail.map(node => node.gate?.()));
    const response = await within(request, segments.slice(0, trail.length - 1), () => method(request, params), seats, params);

    if (!(response instanceof Response)) {
      const node = method.length > 2 ? ` It takes (req, res, next) - a Node handler? Wrap it in fromNode(handler), of @expressive/rpc/node.` : "";
      throw new Error(`${route} returned ${response} - a route answers with a Response.${node}`);
    }

    return withHeaders(response, headersOf(request));
  } catch (error) {
    return failure(error, list, dev);
  }
}
