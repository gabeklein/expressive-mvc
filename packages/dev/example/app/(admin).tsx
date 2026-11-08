export default () => localStorage.getItem("admin") ? undefined : "/";

export function Page() {
  return <h1>Admin area</h1>;
}
