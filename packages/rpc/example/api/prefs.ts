import { Current } from "@expressive/rpc";

/** Keep the theme in a cookie, and answer with the one the request came with. */
export async function theme(name: string): Promise<string | undefined> {
  const { cookies } = Current.get();

  Current.get().setCookie("theme", name, { maxAge: 60 * 60 * 24 * 365 });

  return cookies.theme;
}
