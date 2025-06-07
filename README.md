# Todo App

Next.js 15、TypeScript、PostgreSQLで構築されたモダンなTodoアプリケーションです。

## ✨ 主な機能

- ✅ 優先度レベル付きタスク管理
- 🔐 ユーザー認証 (NextAuth.js)
- 🎨 グラスモーフィズム効果を使ったモダンUI
- 📱 レスポンシブデザイン・ダークモード対応
- 🐳 Docker Compose による簡単デプロイ

## 🚀 クイックスタート

### 必要な環境
- Docker
- Docker Compose

### セットアップ

1. **リポジトリをクローン**
```bash
git clone https://github.com/tnbt1/Simple-ToDo.git
cd Simple-ToDo
```

2. **ワンコマンドで起動**
```bash
./scripts/quick-start.sh
```

これだけです！スクリプトが以下を自動で行います：
- ✅ 環境設定
- 🔑 セキュアキー生成
- 🔧 システム最適化
- 🚀 アプリケーション起動
- 🔍 ヘルスチェック

### アクセス

- **URL**: http://localhost:3000
- **テストアカウント**: test@example.com / test123 (初回起動時に自動作成)
- **新規アカウント作成**: http://localhost:3000/auth/signup

## 🛠️ 便利なコマンド

```bash
make up          # サービス起動
make down        # サービス停止
make logs        # ログ表示
make health      # ヘルスチェック
make restart     # 再起動
```

## 🔧 トラブルシューティング

### PostgreSQL認証エラー

別サーバーでgit clone後に認証エラーが発生する場合：

```bash
# 自動修復（quick-start.shで対応済み）
./scripts/quick-start.sh

# 手動修復
docker compose down
docker volume rm simple-todo_postgres_data
docker compose up -d
```

### ユーザー管理

```bash
# ユーザーが作成されているか確認
./scripts/debug-users.sh

# 新しいアカウントを作成
# http://localhost:3000/auth/signup にアクセス
```

## 📚 詳細情報

- **詳細なセットアップ手順**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **技術スタック**: Next.js 15, PostgreSQL, Redis, Docker

## 📄 ライセンス

MIT License