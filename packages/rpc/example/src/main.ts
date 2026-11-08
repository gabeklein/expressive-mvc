import { configure, Forbidden, HttpError, NotFound, Unauthorized } from "@expressive/rpc/http";
import { stats } from "../api/admin/stats";
import { add, done, list, ProOnly, type Todo } from "../api/todos";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const KINDS = { ProOnly, NotFound, Unauthorized, Forbidden, HttpError };

configure({
  transport(request) {
    const token = localStorage.getItem("token");

    if (token) request.headers.set("authorization", `Bearer ${token}`);

    return fetch(request);
  },
});

let latest = 0;

async function attempt(run: () => Promise<void>) {
  const id = ++latest;

  $("error").textContent = "";

  try {
    await run();
  } catch (error) {
    if (id !== latest) return;

    const kinds = Object.entries(KINDS).filter(([, Type]) => error instanceof Type).map(([name]) => name);
    $("error").textContent = `${kinds.join(" ") || "Error"}: ${(error as Error).message}`;
  }
}

function item(todo: Todo) {
  const li = document.createElement("li");
  const button = document.createElement("button");

  li.textContent = todo.title;
  li.dataset.done = String(todo.done);
  button.textContent = "Done";
  button.onclick = () => attempt(async () => (await done(todo.id), render()));

  if (!todo.done) li.append(" ", button);

  return li;
}

async function render() {
  const id = latest;

  $("who").textContent = localStorage.getItem("token") ?? "signed out";
  $("todos").replaceChildren();

  const todos = await list();

  if (id === latest) $("todos").replaceChildren(...todos.map(item));
}

function signIn(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");

  return attempt(render);
}

$("alice").onclick = () => signIn("alice");
$("admin").onclick = () => signIn("admin");
$("out").onclick = () => signIn(null);
$("missing").onclick = () => attempt(async () => void (await done("missing")));
$("stats").onclick = () => attempt(async () => {
  const { total, done } = await stats();
  $("count").textContent = `${done} of ${total} done`;
});

$<HTMLFormElement>("new").onsubmit = event => {
  event.preventDefault();

  attempt(async () => {
    await add($<HTMLInputElement>("title").value);
    $<HTMLInputElement>("title").value = "";
    await render();
  });
};

if (localStorage.getItem("token")) attempt(render);
