# デプロイメントガイド

## 📋 目次

- [クイックスタート](#クイックスタート)
- [詳細セットアップ](#詳細セットアップ)
- [環境の違い](#環境の違い)
- [設定オプション](#設定オプション)
- [プロダクション環境](#プロダクション環境)
- [トラブルシューティング](#トラブルシューティング)

## 🚀 クイックスタート

### 推奨方法: ワンコマンドセットアップ
```bash
./scripts/quick-start.sh
```

### 手動セットアップ

#### 開発環境
```bash
git clone https://github.com/tnbt1/Simple-ToDo.git
cd Simple-ToDo
cp .env.example .env
sudo ./scripts/docker-host-setup.sh  # システム最適化
docker-compose up -d
```

#### 手動セットアップ
```bash
git clone https://github.com/tnbt1/Simple-ToDo.git
cd Simple-ToDo

# 標準セットアップ
./scripts/quick-start.sh
```

## 🔧 詳細セットアップ

### 1. 環境変数設定

```bash
# .env.exampleをコピー
cp .env.example .env

# セキュアキーを生成
./scripts/generate-secrets.sh
```

#### 主要な環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `POSTGRES_DB` | データベース名 | todoapp |
| `POSTGRES_USER` | データベースユーザー | todouser |
| `POSTGRES_PASSWORD` | データベースパスワード | （自動生成） |
| `NEXTAUTH_URL` | アプリケーションURL | http://localhost:3100 |
| `NEXTAUTH_SECRET` | NextAuth暗号化キー | （自動生成） |
| `REDIS_OPTIMIZE` | Redis最適化有効/無効 | true |
| `APP_VERSION` | アプリケーションバージョン | 1.0.0 |

### 2. システム最適化

Redis警告を防ぐためのシステム設定：

```bash
# 自動スクリプト実行
sudo ./scripts/docker-host-setup.sh

# 手動設定
sudo sysctl vm.overcommit_memory=1
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
```

### 3. アプリケーション起動

```bash
# 通常起動
docker compose up -d

# ログ付きで起動
docker compose up

# バックグラウンド起動 + ログ監視
docker compose up -d && docker compose logs -f
```

## 🏗️ 環境の違い

| 設定項目 | 本番環境 (docker-compose.yml) |
|---------|-------------------------------|
| **PostgreSQL** | postgres:15-alpine + 最適化設定 |
| **Redis** | redis:7-alpine + 最適化 |
| **アプリ** | 最適化ビルド + リソース制限 |
| **ヘルスチェック** | 詳細な設定 |
| **ログ** | ローテーション設定 |
| **リソース制限** | CPU/メモリ制限あり |

## ⚙️ 設定オプション

### Redis最適化

```bash
# 環境変数で制御
REDIS_OPTIMIZE=true   # 有効（デフォルト）
REDIS_OPTIMIZE=false  # 無効（警告は出るが動作）
```

### バージョン管理

```bash
# バージョン確認
cat .version

# バージョン更新
make version-bump

# 特定バージョンでビルド
APP_VERSION=1.1.0 docker compose build
```

## 🏭 本番環境設定

### セキュリティ強化

1. **セキュアキーの生成**
```bash
./scripts/generate-secrets.sh
```

2. **ファイアウォール設定**
```bash
# ポート3000のみ開放
sudo ufw allow 3000
```

3. **SSL/TLS設定**
- Nginx/Apache でリバースプロキシ設定
- Let's Encrypt でSSL証明書取得

### パフォーマンス最適化

```bash
# 最適化設定で起動（デフォルト）
docker compose up -d

# リソース使用量監視
docker stats

# ログ監視
docker compose logs -f
```

### バックアップ

```bash
# データベースバックアップ
docker compose exec postgres pg_dump -U todouser todoapp > backup.sql

# Redisバックアップ
docker compose exec redis redis-cli BGSAVE
```

## 警告の解決方法

### 1. PostgreSQL Collation警告

既存のデータベースで警告が出る場合：

```bash
# データベースに接続
docker compose exec postgres psql -U todouser -d todoapp

# Collationをリセット
UPDATE pg_database SET datcollversion = NULL WHERE datname IN ('todoapp', 'postgres', 'template1');

# 確認
\q
```

新規インストールでは自動的に修正されます。

### 2. Redis Memory Overcommit警告

ホストシステムで実行：

```bash
# 一時的な設定
sudo sysctl vm.overcommit_memory=1

# 永続的な設定
echo 'vm.overcommit_memory = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## パフォーマンスチューニング

### PostgreSQL設定

本番環境用の設定は `docker-compose.prod.yml` に含まれています：
- shared_buffers: 256MB
- effective_cache_size: 1GB
- max_connections: 200

### Redis設定

`redis.conf` ファイルで以下を調整可能：
- maxmemory: 256mb（メモリ制限）
- maxmemory-policy: allkeys-lru（メモリポリシー）

## 監視

### ヘルスチェック

```bash
# サービスの状態確認
docker compose ps

# ログの確認
docker compose logs -f

# 特定サービスのログ
docker compose logs -f app
```

### リソース使用状況

```bash
# コンテナのリソース使用状況
docker stats
```

## バックアップ

### データベースバックアップ

```bash
# バックアップ作成
docker compose exec postgres pg_dump -U todouser todoapp > backup_$(date +%Y%m%d_%H%M%S).sql

# リストア
docker compose exec -T postgres psql -U todouser todoapp < backup_20250606_123456.sql
```

### Redisバックアップ

```bash
# 手動バックアップ
docker compose exec redis redis-cli BGSAVE

# バックアップファイルのコピー
docker compose cp redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d_%H%M%S).rdb
```