export interface AppConfig {
  port?: number;
  remote?: { opaque?: boolean };
}

export function config<T extends AppConfig>(config: T): T {
  return config;
}
