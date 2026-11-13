/** What only runs on Node - kept apart so a Worker's bundle never reaches for `node:http`. */
export { fromNode, type NodeHandler } from "./http/from-node";
