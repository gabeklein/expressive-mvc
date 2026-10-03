export interface AppConfig {
  port?: number;
}

export function app<T extends AppConfig>(config: T): T {
  return config;
}
