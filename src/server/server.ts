import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { TITLE_MAX, type Todo } from "../shared/types.js";
import { TodoStore } from "./store.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const dataFile = process.env.DATA_FILE ?? "data/todos.json";

// 画面のファイルは public/（HTML と CSS）と dist/public/（tsc が出した JS）から返す
const staticRoots = [resolve("public"), resolve("dist/public")];
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const store = new TodoStore(dataFile);

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 10_000) throw new HttpError(413, "body too large");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}

// 外から来た値は unknown として受け取り、中身を確かめてから使う
function parseTitle(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "title must be a string");
  const title = value.trim();
  if (title === "" || title.length > TITLE_MAX) throw new HttpError(400, `title must be 1-${TITLE_MAX} chars`);
  return title;
}

function parsePatch(body: unknown): Partial<Pick<Todo, "title" | "done">> {
  if (typeof body !== "object" || body === null) throw new HttpError(400, "body must be an object");
  const patch: Partial<Pick<Todo, "title" | "done">> = {};
  if ("title" in body) patch.title = parseTitle(body.title);
  if ("done" in body) {
    if (typeof body.done !== "boolean") throw new HttpError(400, "done must be a boolean");
    patch.done = body.done;
  }
  return patch;
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (path === "/api/todos") {
    if (req.method === "GET") return sendJson(res, 200, store.list());
    if (req.method === "POST") {
      const body = await readJson(req);
      const title = typeof body === "object" && body !== null && "title" in body ? body.title : undefined;
      return sendJson(res, 201, store.add(parseTitle(title)));
    }
    throw new HttpError(405, "method not allowed");
  }

  const match = /^\/api\/todos\/([\w-]+)$/.exec(path);
  if (match) {
    const id = match[1];
    if (req.method === "PATCH") {
      const todo = store.update(id, parsePatch(await readJson(req)));
      if (!todo) throw new HttpError(404, "not found");
      return sendJson(res, 200, todo);
    }
    if (req.method === "DELETE") {
      if (!store.remove(id)) throw new HttpError(404, "not found");
      res.writeHead(204);
      res.end();
      return;
    }
    throw new HttpError(405, "method not allowed");
  }

  throw new HttpError(404, "not found");
}

async function handleStatic(res: ServerResponse, path: string): Promise<void> {
  const file = path === "/" ? "/index.html" : path;
  for (const root of staticRoots) {
    const full = join(root, normalize(file));
    // ../ で公開フォルダの外を読まれないようにする
    if (!full.startsWith(root + "/")) break;
    try {
      const data = await readFile(full);
      res.writeHead(200, { "Content-Type": contentTypes[extname(full)] ?? "application/octet-stream" });
      res.end(data);
      return;
    } catch {
      // 次のフォルダを探す
    }
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  try {
    if (path.startsWith("/api/")) {
      await handleApi(req, res, path);
    } else if (req.method === "GET") {
      await handleStatic(res, path);
    } else {
      throw new HttpError(405, "method not allowed");
    }
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message });
    } else {
      console.error(err);
      sendJson(res, 500, { error: "internal error" });
    }
  }
  console.log(`${req.method} ${path} ${res.statusCode}`);
});

server.listen(port, host, () => {
  console.log(`listening on http://${host}:${port}`);
});
