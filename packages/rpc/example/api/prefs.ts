import { Cookies } from "@expressive/rpc";

class Prefs extends Cookies {
  static options = { theme: { maxAge: 60 * 60 * 24 * 365 } };

  theme?: string = undefined;
}

/** Keep the theme in a cookie, and answer with the one the request came with. */
export async function theme(name: string): Promise<string | undefined> {
  const before = Prefs.get().theme;

  Prefs.set({ theme: name });

  return before;
}
