# AWS EC2 に公開する手順

流れは hello-server と同じ（解説スライド [TypeScript をサーバーで動かす](https://yoshito.me/learn/deploy/)）。
ここでは **hello-server と違うところ** を中心に書く。

```
ブラウザ → DNS → セキュリティグループ(22/80/443) → nginx(80/443) → node(127.0.0.1:3000) → dist/server/server.js
                                                                                     └→ data/todos.json
```

## hello-server との違い

| | hello-server | todo-webapp |
|---|---|---|
| 起動するファイル | `dist/server.js` | `dist/server/server.js` |
| 待ち受けるアドレス | すべて | `127.0.0.1`（`HOST` で変更可） |
| データ | なし | `data/todos.json` に書き込む |
| 誰でも操作できるか | 読むだけ | **URL を知っていれば誰でも書き換えられる** → Basic 認証をかける |

## 1. EC2 を用意する

- Ubuntu Server LTS / 無料枠のインスタンス
- セキュリティグループは 22（自分の IP だけ）・80・443。3000 は開けない
- hello-server と同じ EC2 に同居させてもよい（そのときはポートを 3001 などにずらす）

## 2. アプリを置いて手で動かす

```sh
ssh -i ~/.ssh/<鍵>.pem ubuntu@<EC2のIP>
git clone https://github.com/YoshitoSuzuki/todo-webapp.git
cd todo-webapp
npm ci
npm run build
npm start
# 別の SSH から: curl http://127.0.0.1:3000/api/todos  → []
```

## 3. systemd でサービスにする

`/etc/systemd/system/todo-webapp.service`

```ini
[Unit]
Description=todo-webapp (Node.js)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/todo-webapp
Environment=PORT=3000
Environment=NODE_ENV=production
Environment=DATA_FILE=/home/ubuntu/todo-webapp/data/todos.json
ExecStart=/usr/bin/node /home/ubuntu/todo-webapp/dist/server/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now todo-webapp
systemctl status todo-webapp
journalctl -u todo-webapp -f      # 1 リクエストごとに「GET /api/todos 200」のような行が出る
```

`WorkingDirectory` は必須。画面のファイル（`public/`・`dist/public/`）をここからの相対パスで探す。

## 4. nginx と Basic 認証

このアプリにはログインの仕組みが無いので、nginx でパスワードをかける。

```sh
sudo apt install -y nginx apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd <ユーザー名>     # パスワードを聞かれる
```

`/etc/nginx/sites-available/todo-webapp`

```nginx
server {
    listen 80;
    server_name todo.example.com;

    auth_basic "todo";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```sh
sudo ln -s /etc/nginx/sites-available/todo-webapp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d todo.example.com      # Basic 認証のパスワードを平文で流さないため、HTTPS は必ず
```

## 5. 更新するとき

```sh
cd ~/todo-webapp
git pull
npm ci
npm run build
sudo systemctl restart todo-webapp
```

`data/` は `.gitignore` に入っているので、`git pull` でデータが消えることはない。

## データのバックアップ

データは `data/todos.json` の 1 ファイルだけ。手元にコピーするなら:

```sh
scp -i ~/.ssh/<鍵>.pem ubuntu@<EC2のIP>:todo-webapp/data/todos.json ./todos-backup.json
```

EC2 を終了すると EBS ごと消えるので、残したいデータは先に取り出す。

## トラブル

- 画面が真っ白: ブラウザの開発者ツールで `/client/app.js` が 404 になっていないか。`npm run build` を忘れている
- `502 Bad Gateway`: `systemctl status todo-webapp` と `journalctl -u todo-webapp -n 50`
- 保存できない（500）: `data/` に書き込めるか。`User=` のユーザーが `WorkingDirectory` の持ち主か

## 片付け

練習が終わったら EC2 インスタンスの終了と Elastic IP の解放。使っていない Elastic IP は課金される。
