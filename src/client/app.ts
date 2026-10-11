import { TITLE_MAX, type Todo } from "../shared/types.js";

type Filter = "all" | "active" | "done";

let todos: Todo[] = [];
let filter: Filter = "all";

function $<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} not found`);
  return el;
}

const form = $<HTMLFormElement>("#new-form");
const input = $<HTMLInputElement>("#new-title");
const list = $<HTMLUListElement>("#list");
const count = $<HTMLSpanElement>("#count");
const clearDone = $<HTMLButtonElement>("#clear-done");
const errorBox = $<HTMLParagraphElement>("#error");

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const message = typeof data === "object" && data !== null && "error" in data ? String(data.error) : res.statusText;
    throw new Error(message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// 失敗したらサーバーの状態を読み直して、画面とずれないようにする
async function run(action: () => Promise<void>): Promise<void> {
  try {
    errorBox.hidden = true;
    await action();
  } catch (err) {
    errorBox.textContent = err instanceof Error ? err.message : String(err);
    errorBox.hidden = false;
    todos = await api<Todo[]>("GET", "/api/todos").catch(() => todos);
  }
  render();
}

function visible(todo: Todo): boolean {
  if (filter === "active") return !todo.done;
  if (filter === "done") return todo.done;
  return true;
}

function renderItem(todo: Todo): HTMLLIElement {
  const li = document.createElement("li");
  li.className = todo.done ? "item done" : "item";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = todo.done;
  check.addEventListener("change", () =>
    run(async () => {
      const updated = await api<Todo>("PATCH", `/api/todos/${todo.id}`, { done: check.checked });
      todos = todos.map((t) => (t.id === updated.id ? updated : t));
    }),
  );

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = todo.title; // textContent なので、入力に HTML が混ざっても実行されない
  title.addEventListener("dblclick", () => startEdit(li, todo));

  const del = document.createElement("button");
  del.className = "delete";
  del.type = "button";
  del.textContent = "×";
  del.setAttribute("aria-label", "削除");
  del.addEventListener("click", () =>
    run(async () => {
      await api<void>("DELETE", `/api/todos/${todo.id}`);
      todos = todos.filter((t) => t.id !== todo.id);
    }),
  );

  li.append(check, title, del);
  return li;
}

function startEdit(li: HTMLLIElement, todo: Todo): void {
  const edit = document.createElement("input");
  edit.className = "edit";
  edit.value = todo.title;
  edit.maxLength = TITLE_MAX;
  let finished = false;

  const finish = (save: boolean) => {
    if (finished) return;
    finished = true;
    const title = edit.value.trim();
    if (!save || title === "" || title === todo.title) return render();
    run(async () => {
      const updated = await api<Todo>("PATCH", `/api/todos/${todo.id}`, { title });
      todos = todos.map((t) => (t.id === updated.id ? updated : t));
    });
  };
  edit.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) finish(true);
    if (e.key === "Escape") finish(false);
  });
  edit.addEventListener("blur", () => finish(true));

  li.querySelector(".title")?.replaceWith(edit);
  edit.focus();
}

function render(): void {
  list.replaceChildren(...todos.filter(visible).map(renderItem));
  const left = todos.filter((t) => !t.done).length;
  count.textContent = `残り ${left}`;
  clearDone.hidden = !todos.some((t) => t.done);
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-filter]")) {
    button.classList.toggle("selected", button.dataset.filter === filter);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (title === "") return;
  run(async () => {
    todos.push(await api<Todo>("POST", "/api/todos", { title }));
    input.value = "";
  });
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-filter]")) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter as Filter;
    render();
  });
}

clearDone.addEventListener("click", () =>
  run(async () => {
    for (const todo of todos.filter((t) => t.done)) {
      await api<void>("DELETE", `/api/todos/${todo.id}`);
      todos = todos.filter((t) => t.id !== todo.id);
    }
  }),
);

input.maxLength = TITLE_MAX;
run(async () => {
  todos = await api<Todo[]>("GET", "/api/todos");
});
