import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Todo } from "../shared/types.js";

// ToDo を JSON ファイルに保存する。プロセスは1つなので、毎回ファイルごと書き直す
export class TodoStore {
  private todos: Todo[];

  constructor(private readonly file: string) {
    this.todos = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Todo[]) : [];
  }

  list(): Todo[] {
    return this.todos;
  }

  add(title: string): Todo {
    const todo: Todo = { id: randomUUID(), title, done: false, createdAt: new Date().toISOString() };
    this.todos.push(todo);
    this.save();
    return todo;
  }

  update(id: string, patch: Partial<Pick<Todo, "title" | "done">>): Todo | undefined {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) return undefined;
    Object.assign(todo, patch);
    this.save();
    return todo;
  }

  remove(id: string): boolean {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => t.id !== id);
    if (this.todos.length === before) return false;
    this.save();
    return true;
  }

  // 一時ファイルに書いてから置き換える。書き込み中に落ちても元のファイルが壊れない
  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.todos, null, 2));
    renameSync(tmp, this.file);
  }
}
