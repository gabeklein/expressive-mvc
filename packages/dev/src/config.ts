export interface AppConfig {
  port?: number;
}

export function defineApp<T extends AppConfig>(config: T): T {
  return config;
}
