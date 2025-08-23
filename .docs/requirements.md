# 🎯 AI音声日記アプリ - 最終実装要件

## 📱 アプリの目的
うつ病の予防・診断支援のための音声日記アプリ

- 音声で話すだけで日記が自動生成
- AIが感情を分析して可視化
- 継続的なメンタルヘルス管理

## 🔧 使用技術スタック

### フロントエンド・バックエンド統合
- Next.js (TypeScript) - フルスタックアプリケーション
- Tailwind CSS - スタイリング
- MediaRecorder API + extendable-media-recorder-wav-encoder - WAV形式で音声録音
- Vercel - ホスティング

### データストレージ
- Supabase Storage - WAVファイル保存
- Supabase Database (PostgreSQL) - 日記データ・対話履歴・感情スコア保存

### 感情分析
- AWS Lambda (Python) - 既存の音声感情分析エンジン実行
- Lambda Function URL - API Gateway不要で直接アクセス

### AI・音声処理
- Whisper API (OpenAI) - 音声文字起こし
- Claude 3 Haiku - 各発話の文章整形（フィラー除去・句読点追加）
- Claude 3.5 Sonnet - AI深掘り質問・日記生成

## 🎮 実装する機能と対話フロー

### 対話の流れ（5ラリー）

1. **初回録音（1分）**
   - ユーザーが今日の出来事を1分程度話す
   - WAVファイルをSupabase Storageに保存
   - Whisper APIで文字起こし
   - Claude 3 Haikuで文章整形

2. **AI深掘り質問 → ユーザー回答（4回繰り返し）**
   - Claude 3.5 Sonnetが前の発話を基に深掘り質問生成
   - ユーザーが1分程度で回答録音
   - 各回答をWAV保存・文字起こし・整形

3. **最終的な日記生成**
   - 5回分の対話履歴を基にClaude 3.5 Sonnetが日記生成
   - 全音声ファイルをAWS Lambdaで感情分析
   - 日記と感情スコアを表示

### 具体的な対話例
1. ユーザー: 「今日は会社でプレゼンがあって...」（1分録音）
2. AI: 「プレゼンの準備で特に大変だったことは何でしたか？」
3. ユーザー: 「資料作りが大変で...」（1分録音）
4. AI: 「その時の気持ちをもう少し詳しく教えてください」
5. ...（繰り返し）
→ 最終的に詳細な日記を自動生成

## 💻 処理フロー（各ラリーごと）

1. **録音開始** - MediaRecorderでWAV形式録音（1分）
2. **録音終了** - WAVファイルをSupabase Storageに保存
3. **文字起こし** - Next.js API RouteからWhisper API呼び出し
4. **文章整形** - Claude 3 Haikuで「えーっと」等を除去、句読点追加
5. **深掘り質問生成** - Claude 3.5 Sonnetが前の内容から質問作成
6. **対話履歴保存** - Supabase Databaseに保存
7. **次のラリーへ** - 5ラリー完了まで繰り返し

### 全ラリー完了後
- **感情分析** - 5つのWAVファイルをAWS Lambdaで一括分析
- **日記生成** - Claude 3.5 Sonnetが全対話から日記作成
- **結果表示** - 日記と感情グラフを表示、MDファイル出力可能

## 📁 Next.js API Routes構成
```
app/api/
├── whisper/route.ts         # Whisper API呼び出し（文字起こし）
├── format-text/route.ts     # Claude 3 Haiku（文章整形）
├── generate-question/route.ts # Claude 3.5 Sonnet（深掘り質問）
├── generate-diary/route.ts   # Claude 3.5 Sonnet（日記生成）
├── analyze-emotion/route.ts  # AWS Lambda呼び出し（感情分析）
├── upload-audio/route.ts     # Supabase Storage保存
└── save-dialogue/route.ts    # Supabase DB保存
```

## 🔧 AWS Lambda設定
5つのWAVファイル（各1分）を一括で感情分析。Lambda Function URLで直接呼び出し可能。既存のPython感情分析エンジンをそのまま使用。月額コストは約15円。

## 💰 月額コスト（1000人想定）
- Whisper API: 約3,600円（5分×1000人）
- Claude 3 Haiku: 約50円（整形5回×1000人）
- Claude 3.5 Sonnet: 約400円（質問4回+日記1回×1000人）
- Supabase: 無料枠内
- AWS Lambda: 約15円
- Vercel: 無料枠内
- **合計: 約4,065円/月**

## 📅 開発スケジュール

### Phase 1: 基本機能（3日）
音声録音機能（1分制限）、Supabase Storage保存、Whisper API連携、Claude 3 Haiku整形、基本UIの構築。

### Phase 2: 対話機能（3日）
Claude 3.5 Sonnet深掘り質問生成、5ラリーの対話フロー実装、対話履歴管理、UI/UXの改善。

### Phase 3: 完成機能（3日）
AWS Lambda感情分析統合、日記自動生成機能、感情グラフ表示、MDファイル出力、全体の調整。

## ✅ 成功指標
- 5ラリーの対話が10分以内で完了
- 各音声の文字起こし・整形が5秒以内
- 感情分析の精度80%以上
- ユーザーが週3回以上継続使用
- システムエラー率1%未満

## 🎯 この構成の強み
Next.jsで完結するシンプルな構成。API RoutesですべてのAI処理を管理し、開発・保守が容易。対話型のインタラクションにより、ユーザーの感情や出来事を深く掘り下げることが可能。各発話を整形することで、高品質な日記生成を実現。感情分析は独立したLambdaで効率的に処理。