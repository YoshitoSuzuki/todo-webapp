# todo-webapp

ブラウザから操作する ToDo アプリ。TypeScript（サーバー・画面とも）、外部ライブラリなし。
hello-server と同じく AWS EC2 + systemd + nginx で公開する練習用（public リポジトリ）。
仕組みは README.md、公開手順は docs/aws-deploy.md。

- 外部ライブラリ（npm パッケージ）は入れない。devDependencies の typescript と @types/node だけ
- 画面に説明文を書かない。ボタンやラベルは短い名前にする
- ビルドは `npm run build`（tsconfig.server.json と tsconfig.client.json の 2 本）

## ブランチ運用

Git-flow。main から develop を切り、develop から `<type>/<short-kebab-case>` の作業ブランチを切る。
作業ブランチ → develop（squash merge）→ 公開時に develop → main。マージ後の作業ブランチは削除する。
コミットメッセージは英語小文字の短文。
