export async function call(pattern: string[], name: string, args: unknown[]): Promise<unknown> {
  const at = location.pathname.split("/").filter(Boolean);
  const path = pattern.map((part, i) => {
    if (part === "*") return at.slice(i).join("/");

    if (at[i] === undefined || !part.startsWith(":") && part !== at[i])
      throw new Error(`${name}() belongs to /${pattern.join("/")} and cannot be called from ${location.pathname}.`);

    return at[i];
  });

  const res = await fetch("/" + path.join("/"), {
    method: "POST",
    headers: { "content-type": "application/json", "x-expressive-call": name },
    body: JSON.stringify(args),
  });

  if (res.status === 204) return;

  const body = await res.json();

  if (!res.ok) throw new Error(body.message);

  return body;
}
