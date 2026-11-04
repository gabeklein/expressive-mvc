export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export const todos: Todo[] = [{ id: "seed", title: "Read the docs", done: false }];
