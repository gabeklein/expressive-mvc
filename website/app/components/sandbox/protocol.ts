export type Command =
  | { kind: 'init'; files: Record<string, string> }
  | { kind: 'sync'; files: Record<string, string> }
  | { kind: 'complete'; path: string; code: string; pos: number }
  | {
      kind: 'details';
      path: string;
      pos: number;
      name: string;
      source?: string;
      data?: unknown;
    }
  | { kind: 'quickInfo'; path: string; code: string; pos: number };

export type Request = Command & { id: number };

export interface Response {
  id: number;
  result: unknown;
}

export interface CompletionEntry {
  name: string;
  type?: string;
  source?: string;
  data?: unknown;
}

export interface CompleteResult {
  replacement?: { start: number; length: number };
  entries: CompletionEntry[];
}

export interface Detail {
  display: string;
  documentation: string;
}

export interface QuickInfo {
  display: string;
  documentation: string;
  span: { start: number; length: number };
}
