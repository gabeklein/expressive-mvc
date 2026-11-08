import { todos } from "../../data/todos";

export async function stats(): Promise<{ total: number; done: number }> {
  return { total: todos.length, done: todos.filter(todo => todo.done).length };
}
