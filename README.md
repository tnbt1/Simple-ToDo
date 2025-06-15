# Todo App

Next.js 15、TypeScript、PostgreSQLで構築されたモダンなTodoアプリケーションです。

## ✨ 主な機能

### 基本機能
- ✅ 優先度レベル付きタスク管理（高・中・低）
- 📁 カテゴリー分類とグループ表示
- 🔍 リアルタイム検索・フィルタリング
- 📅 期限管理と自動アラート表示
- 🎨 グラスモーフィズム効果を使ったモダンUI
- 🌓 ダークモード対応

### 認証・セキュリティ
- 🔐 セキュアなユーザー認証 (NextAuth.js)
- 👤 プロフィール管理（名前・アバター画像）
- 🔑 JWT セッション管理（30日間有効）

### コラボレーション機能（NEW!）
- 🔗 タスク・カテゴリーの共有URL生成
- 💬 タスクごとのスレッド機能
- 🖼️ スレッド内での画像投稿対応
- 🔄 リアルタイムに近い進捗同期

### モバイル対応
- 📱 完全レスポンシブデザイン
- 👆 タッチフレンドリーなUI
- 📱 モバイル専用ナビゲーション

### インフラ
- 🐳 Docker Compose による簡単デプロイ
- 🚀 ワンコマンド起動
- 🔧 自動ヘルスチェック機能

## 🚀 クイックスタート

### 必要な環境
- Docker
- Docker Compose
- Node.js 20以上（開発時のみ）

### セットアップ

1. **リポジトリをクローン**
```bash
git clone https://github.com/tnbt1/Simple-ToDo.git
cd Simple-ToDo
```

2. **依存関係のインストール（開発時）**
```bash
npm install
```

3. **ワンコマンドで起動**
```bash
./scripts/quick-start.sh
```

これだけです！スクリプトが以下を自動で行います：
- ✅ 環境設定
- 🔑 セキュアキー生成
- 🔧 システム最適化
- 🗄️ データベースマイグレーション
- 🚀 アプリケーション起動
- 🔍 ヘルスチェック

### アクセス

- **URL**: http://localhost:3100
- **テストアカウント**: test@example.com / test123 (初回起動時に自動作成)
- **新規アカウント作成**: http://localhost:3100/auth/signup

## 🎯 使い方

### タスク管理
1. **タスクの作成**: 「+ 新しいタスクを追加」ボタンをクリック
2. **優先度設定**: 高・中・低から選択
3. **カテゴリー分類**: 既存カテゴリーを選択または新規作成
4. **期限設定**: カレンダーから日付を選択

### タスク共有
1. タスクの共有アイコン（↗）をクリック
2. 生成されたURLをコピー
3. 他のユーザーと共有

### スレッド機能
1. タスクのメッセージアイコン（💬）をクリック
2. コメントを入力して送信
3. 画像アイコンから画像を添付可能

### アカウント管理
1. 右上の設定アイコン（⚙）をクリック
2. プロフィール画像や名前を編集
3. アカウント統計情報の確認

## 🛠️ 便利なコマンド

```bash
make install     # 依存関係のインストール
make up          # サービス起動
make down        # サービス停止
make logs        # ログ表示
make health      # ヘルスチェック
make restart     # 再起動
make reset-db    # データベースリセット
```

## 📂 プロジェクト構造

```
todo-app/
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── api/        # APIエンドポイント
│   │   ├── tasks/      # タスク詳細ページ
│   │   ├── shared/     # 共有タスク表示
│   │   └── account/    # アカウント管理
│   ├── components/     # 共通コンポーネント
│   └── lib/           # ユーティリティ
├── prisma/            # データベーススキーマ
├── scripts/           # 運用スクリプト
└── docker-compose.yml # Docker設定
```

## 🔧 技術スタック

### フロントエンド
- **Next.js 15.3.3** - React フレームワーク
- **TypeScript** - 型安全な開発
- **Tailwind CSS v4** - ユーティリティファーストCSS
- **Framer Motion** - アニメーション
- **Lucide React** - アイコンライブラリ

### バックエンド
- **Next.js API Routes** - サーバーレスAPI
- **NextAuth.js v4** - 認証システム
- **Prisma ORM v6** - データベースORM
- **bcryptjs** - パスワードハッシュ化

### インフラ
- **PostgreSQL 15** - メインデータベース
- **Redis 7** - セッション管理・キャッシュ
- **Docker & Docker Compose** - コンテナ化
- **Node.js 20** - ランタイム

## 🔧 トラブルシューティング

### PostgreSQL認証エラー

別サーバーでgit clone後に認証エラーが発生する場合：

```bash
# 自動修復（quick-start.shで対応済み）
./scripts/quick-start.sh

# 手動修復
docker compose down -v
docker compose up -d
```

### ポート競合エラー

ポート3100が使用中の場合：

```bash
# 使用中のプロセスを確認
lsof -i :3100

# docker-compose.ymlでポートを変更
# ports:
#   - "3200:3000"  # 3200に変更
```

### ユーザー管理

```bash
# ユーザーが作成されているか確認
./scripts/debug-users.sh

# 新しいアカウントを作成
# http://localhost:3100/auth/signup にアクセス
```

## 🚀 本番環境へのデプロイ

### 環境変数の設定

```bash
# .env.production を作成
cp .env.example .env.production

# 以下を編集
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secure-secret
DATABASE_URL=your-production-database-url
```

### セキュリティ推奨事項

1. **HTTPS化**: 本番環境では必ずHTTPSを使用
2. **環境変数**: セキュアな値を生成して使用
3. **画像ストレージ**: S3やCloudinaryを推奨
4. **バックアップ**: データベースの定期バックアップ

## 📚 詳細情報

- **詳細なセットアップ手順**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **API仕様**: `/api/*` エンドポイントはRESTful設計

## 🤝 貢献

プルリクエストを歓迎します！

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 👥 作者

- [@tnbt1](https://github.com/tnbt1)

---

⭐ このプロジェクトが気に入ったら、スターをお願いします！