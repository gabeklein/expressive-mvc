export interface AppConfig {
  port?: number;
  hashCalls?: boolean;
}

export function config<T extends AppConfig>(config: T): T {
  return config;
}
