# Next.js スターター プロジェクト

このプロジェクトは Next.js をベースにした Web アプリケーション開発のためのスターターテンプレートです。

## 開発環境のセットアップ

### 環境変数の設定

1. `env.local.example` ファイルを `.env.local` にコピーし、必要な値を設定してください：

```bash
cp .env.local.example .env.local
```

2. `.env.local` ファイルを開き、必要な環境変数を設定します。

### ローカル開発の開始方法

1. プロジェクトの依存関係をインストールし、開発サーバーを起動します：

```bash
pnpm dev
```

2. Supabase のローカルインスタンスを起動します：

```bash
supabase start
```

> **注意**: 開発終了後は `supabase stop` コマンドを実行してください。停止しないとバックグラウンドで動き続けます。

## Trigger.dev の設定

[Trigger.dev](https://trigger.dev) はワークフローの自動化とジョブのスケジューリングを提供するサービスです。

1. Trigger.dev の初期化：

```bash
npx trigger.dev@latest init
```

2. Trigger.dev のデプロイ：

```bash
npx trigger.dev@latest deploy
```

3. 開発時に Trigger.dev サーバーを起動：

```bash
npx trigger.dev@latest dev
```

## Prisma データベース操作

[Prisma](https://prisma.io) はデータベースの ORM ツールです。以下のコマンドを使用してデータベースを管理します。

### ローカル開発時

- スキーマをローカルデータベースに直接反映（開発時）：

```bash
npx prisma db push
```

- クライアントコードの生成：

```bash
npx prisma generate
```

### 本番環境準備時

- マイグレーションファイルの作成（PR 提出前）：

```bash
npx prisma migrate dev --name <変更の説明>
```

### トラブルシューティング

マイグレーションやデータベース同期に問題が発生した場合は、以下の手順を試してください：

#### マイグレーションとデータベースの同期エラー

データベースのスキーマとマイグレーション履歴に不一致がある場合（「Drift detected」などのエラーが表示される場合）：

```bash
# データベースをリセットし、すべてのマイグレーションを最初から適用
npx prisma migrate reset
```

> **注意**: このコマンドはデータベースのすべてのデータを削除します。開発環境でのみ使用してください。

#### Prismaのバージョン不一致

prismaと@prisma/clientのバージョンが一致していない場合（警告メッセージが表示される場合）：

```bash
# @prisma/clientのバージョンをprismaと一致させる
pnpm install @prisma/client@<prismaのバージョン>

# Prisma Clientを再生成
npx prisma generate
```

バージョンの不一致は予期しない動作を引き起こす可能性があるため、常に両方のパッケージのバージョンを一致させることをお勧めします。

### GitHub Actions

- **重要**: Check Prisma Schema / schema-check (pull_request) の GitHub Action が成功しなかった場合、PRをマージしてはいけません。

#### GitHub Action がエラーになった場合の対処方法

下記のコマンドを実行して変更分をpushして下さい。

```bash
npx prisma migrate dev --name <変更の説明>
```

## Stripe の設定

決済機能を使用する場合は、Stripe の設定が必要です。

1. [Stripe ダッシュボード](https://dashboard.stripe.com) で Webhook の設定を行ってください。

2. （オプション）テスト用の製品とプライシングデータをセットアップ：

```bash
stripe fixtures fixtures/stripe-fixtures.json
```

## プロジェクトアーキテクチャ

プロジェクトのアーキテクチャに関する詳細なドキュメントは `.docs/` ディレクトリにあります：

- フロントエンドアーキテクチャ: [.docs/frontend-architecture.md](.docs/frontend-architecture.md)
- バックエンドアーキテクチャ: [.docs/backend-architecture.md](.docs/backend-architecture.md)
- トランザクション管理: [.docs/transaction-manager.md](.docs/transaction-manager.md)

## Cline のカスタムインストラクション設定

Cline を使用する場合は、以下の Notion ドキュメントの内容をコピーして Custom Instructions に貼り付けてください：

[https://www.notion.so/technochain/cline-custom-instruction-1b72995e0cb98027a98fcd7b55ed1c91](https://www.notion.so/technochain/cline-custom-instruction-1b72995e0cb98027a98fcd7b55ed1c91)
