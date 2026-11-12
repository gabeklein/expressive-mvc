declare module "virtual:docs-tree" {
  const tree: import("./tree").Node[];
  export default tree;
}

declare module "virtual:docs-search" {
  const documents: import("./tree").Document[];
  export default documents;
}
