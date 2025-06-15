#!/bin/bash

# スタンドアロンモードでアプリケーションを起動するスクリプト

echo "🚀 Todo App Development Mode"
echo "============================"
echo ""

# 環境変数を設定
export DATABASE_URL="postgresql://todouser:3sfGNFGh6o6RO75Q@localhost:5432/todoapp?schema=public"
export NEXTAUTH_URL="http://localhost:3100"
export NODE_ENV="development"

echo "📝 環境設定:"
echo "- データベース: ローカルPostgreSQL"
echo "- アプリURL: http://localhost:3100"
echo ""

# データベースの準備（ローカルに存在する場合）
echo "🔧 データベースの準備中..."
npx prisma generate 2>/dev/null || true
npx prisma db push 2>/dev/null || {
    echo "⚠️  データベース接続エラー"
    echo "   PostgreSQLが起動していることを確認してください"
    echo ""
    echo "📌 Dockerを使用する場合:"
    echo "   ./scripts/quick-start.sh"
    echo ""
    echo "📌 ローカルPostgreSQLを使用する場合:"
    echo "   1. PostgreSQLを起動"
    echo "   2. todoappデータベースを作成"
    echo "   3. このスクリプトを再実行"
    echo ""
}

# 開発サーバーを起動
echo "🚀 開発サーバーを起動中..."
echo "   URL: http://localhost:3100"
echo ""

npm run dev