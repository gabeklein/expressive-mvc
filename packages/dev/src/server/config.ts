/** Server settings - the default export of the app's `index.ts`. */
export interface AppConfig {
  /** Port to listen on - production defaults to 3000, dev to Vite's. */
  port?: number;
  /** `opaque: false` keeps readable call names in a build, for clients that must outlive a deploy. Default hashed per build. */
  remote?: { opaque?: boolean };
}

/**
 * Types the server entry's settings - identity at runtime.
 *
 * @example
 * export default config({ port: 8080 });
 */
export function config<T extends AppConfig>(config: T): T {
  return config;
}
