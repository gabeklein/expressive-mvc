export async function call(pattern: string[], name: string, args: unknown[]): Promise<unknown> {
  const at = location.pathname.split("/").filter(Boolean);
  const fixed = pattern.every(part => part !== "*" && !part.startsWith(":"));
  const path: string[] = fixed ? pattern : [];

  for (let i = 0; !fixed && i < pattern.length; i++) {
    const part = pattern[i];

    if (part === "*") {
      path.push(...at.slice(i));
      break;
    }

    if (at[i] === undefined || (!part.startsWith(":") && part !== at[i]))
      throw new Error(`${name}() belongs to /${pattern.join("/")} and was called from ${location.pathname}.`);

    path.push(part.startsWith(":") ? at[i] : part);
  }

  const response = await fetch("/" + [...path, name].join("/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  const result = await response.json();

  if (!response.ok) throw new Error(result?.error ?? response.statusText);

  return result;
}
