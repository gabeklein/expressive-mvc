export interface AppConfig {
  port?: number;
}

export function config<T extends AppConfig>(config: T): T {
  return config;
}
