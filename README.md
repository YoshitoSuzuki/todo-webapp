# todo-webapp

ブラウザから操作できる小さな ToDo アプリ。サーバーも画面側のスクリプトも TypeScript で書いている。
外部ライブラリは使わず、Node.js 標準の `node:http` だけで動く。

[hello-server](https://github.com/YoshitoSuzuki/hello-server) の次の段階として、同じように AWS EC2 に公開する練習用。

- 追加・完了のチェック・ダブルクリックで名前の変更・削除
- 「すべて / 未完了 / 完了」の絞り込み、完了したものをまとめて消す
- データはサーバーの JSON ファイル（既定は `data/todos.json`）に保存する

## 動かし方

```sh
npm install
npm run build          # サーバー用と画面用の 2 回 tsc を実行する
npm start              # listening on http://127.0.0.1:3000
```

ブラウザで http://localhost:3000 を開く。型チェックだけなら `npm run check`。

| 環境変数 | 既定値 | 意味 |
|---|---|---|
| `PORT` | `3000` | 待ち受けるポート |
| `HOST` | `127.0.0.1` | 待ち受けるアドレス。nginx を前に置くので外には開かない |
| `DATA_FILE` | `data/todos.json` | 保存先。作業ディレクトリからの相対パスか絶対パス |

## 構成

```
src/
  shared/types.ts   サーバーとブラウザで共有する Todo 型
  server/server.ts  HTTP サーバー（API と画面ファイルの配信）
  server/store.ts   JSON ファイルへの保存
  client/app.ts     画面の動き（fetch で API を呼ぶ）
public/             index.html と style.css（ビルド不要）
tsconfig.server.json  → dist/server/ に出力（Node.js 向け）
tsconfig.client.json  → dist/public/ に出力（ブラウザ向け、DOM の型を使う）
```

サーバーは `/` へのアクセスに `public/` と `dist/public/` のファイルを返し、`/api/` 以下を API として扱う。

### API

| メソッド | パス | 本文 | 返すもの |
|---|---|---|---|
| GET | `/api/todos` | | Todo の配列 |
| POST | `/api/todos` | `{"title": "..."}` | 作った Todo（201） |
| PATCH | `/api/todos/:id` | `{"title"?: "...", "done"?: true}` | 更新した Todo |
| DELETE | `/api/todos/:id` | | なし（204） |

```sh
curl -X POST localhost:3000/api/todos -H 'Content-Type: application/json' -d '{"title":"牛乳を買う"}'
```

## EC2 に公開する

手順は [docs/aws-deploy.md](docs/aws-deploy.md)。
