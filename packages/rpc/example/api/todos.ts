import { HttpError, NotFound } from "@expressive/rpc/http";
import { todos, type Todo } from "../data/todos";

export type { Todo };

export class ProOnly extends HttpError {
  status = 402;
}

export async function list(): Promise<Todo[]> {
  return todos;
}

export async function add(title: string): Promise<Todo> {
  if (title.length > 40) throw new ProOnly("Titles over 40 characters are a Pro feature.");

  const todo = { id: crypto.randomUUID(), title, done: false };

  todos.push(todo);

  return todo;
}

export async function done(id: string): Promise<Todo> {
  const todo = todos.find(todo => todo.id === id);

  if (!todo) throw new NotFound(`No todo ${id}.`);

  todo.done = true;

  return todo;
}
