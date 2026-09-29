export default async function () {
  const isAdmin = confirm("Are you an admin?");
  await new Promise(resolve => setTimeout(resolve, 600));
  if(!isAdmin) return "/";
}

export function Page() {
  return <h1>Admin area</h1>;
}