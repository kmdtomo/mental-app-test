# Mental-Test アプリケーション 要件定義・データフロー

## 概要
Mental-Testは音声入力による日記アプリケーションです。ユーザーが音声で日々の出来事や感情を記録し、AIが対話を通じて本音を引き出し、感情分析を行い、最終的に日記として整理します。

---

## 画面構成と機能要件

### 1. ダッシュボード画面 (`/dashboard`)

**目的**: ユーザーの日記記録状況を一覧表示し、新規日記の作成を促す

**主要機能**:
- 今日の日記の有無を確認
- 登録した月から現在まで全期間の日記サマリーをカレンダー表示
- 録音回数の残り表示（1日の上限管理）
- 新規日記作成へのCTA

**データフロー**:
```
1. ユーザー認証確認 (Supabase Auth)
2. daily_summaries テーブルから全期間のデータを取得
   - user_id でフィルタ
   - date 降順でソート
   - 件数制限なし（全期間）
3. 今日の録音回数をカウント (recordings テーブル)
4. 画面表示
```

**遷移先**:
- `/diary-chat` - AIとの対話を開始
- `/diary/[date]` - 過去の日記詳細を表示

---

### 2. AIとの対話画面 (`/diary-chat`)

**目的**: 音声録音とAI対話を通じて、ユーザーの感情や出来事を引き出す

**主要機能**:
- 音声録音（最大60秒）
- **1日に複数回の録音・対話が可能**（1日5回まで）
- リアルタイム文字起こし
- 感情分析（セグメント単位）
- AI応答生成
- 対話履歴の表示（1日分の全対話を表示）
- 日記生成ボタン

**詳細なデータフロー**:

#### 録音完了時の処理
```
1. 音声録音完了（Blob形式）
   ↓
2. Supabase Storageにアップロード
   - voice-recordings バケット
   - ファイル名: {user_id}/{timestamp}.webm
   ↓
3. recordings テーブルにレコード作成
   - recording_id が発行される
   ↓
4. Whisper API呼び出し (/api/whisper-segmented)
   - OpenAI Whisper APIで文字起こし
   - 単語レベルのタイムスタンプ取得
   - GPT-4o-miniで句読点付与
   - 句読点で文単位に分割
   ↓
5. transcription_segments テーブルに保存
   - 各セグメント: text, start_time, end_time
   ↓
6. dialogue_turns テーブルに保存
   - role: 'user'
   - content: 句読点付きの全文
   - recording_id: 録音ID
   ↓
7. 感情分析API呼び出し (/api/analyze-emotion-segmented)
   - 各セグメントの音声を切り出し
   - Pythonスクリプトで感情分析（VAD値）
   - arousal（覚醒度）、valence（快度）、dominance（優位性）
   ↓
8. transcription_segments テーブルを更新
   - arousal, valence, dominance, emotion_label を追加
   ↓
9. UI上でユーザーメッセージを表示
   - セグメント別の感情データも表示
   ↓
10. AI応答生成 (/api/ai-chat)
    - 対話履歴を取得
    - 感情分析結果を取得
    - GPT-4o-miniでプロンプト生成
    - AI応答を生成
    ↓
11. dialogue_turns テーブルに保存
    - role: 'assistant'
    - content: AI応答
    ↓
12. UI上でAI応答を表示
```

#### 日記生成ボタン押下時
```
1. /api/generate-summary を呼び出し
   ↓
2. daily_summaries から既存データを取得
   ↓
3. dialogue_turns から全会話を取得
   ↓
4. emotion_analysis_results から感情データを取得
   ↓
5. GPT-4o-miniで2つの処理を並列実行
   - 日記要約生成（150-200文字）
   - AIインサイト生成（80-120文字）
   ↓
6. daily_summaries テーブルを更新
   - formatted_text: 日記要約
   - ai_insights: AIインサイト
   - avg_arousal, avg_valence, avg_dominance
   ↓
7. /diary/[date] にリダイレクト
```

**使用テーブル**:
- `recordings` - 録音メタデータ
- `transcription_segments` - 文字起こしセグメント
- `dialogue_turns` - 対話履歴
- `emotion_analysis_results` - 感情分析結果（廃止予定？）

---

### 3. 音声日記画面 (`/voice-diary`)

**目的**: シンプルな音声録音と文字起こしのみ（AI対話なし）

**主要機能**:
- 音声録音（最大60秒）
- Whisperによる文字起こし
- 感情分析の可視化
- セグメント別の感情表示

**データフロー**:
```
1. 音声録音完了
   ↓
2. Supabase Storageにアップロード
   ↓
3. recordings テーブルに保存
   ↓
4. /api/whisper-segmented を呼び出し
   - 文字起こし + セグメント分割
   ↓
5. /api/analyze-emotion-segmented を呼び出し
   - 感情分析
   ↓
6. UI上で結果表示
   - 文字起こしテキスト
   - セグメント別感情分析
   - VAD値（覚醒度・快度・優位性）
   - 料金情報（Whisper, Claude）
```

**特徴**:
- AI対話なし
- 感情分析の詳細表示に特化
- デバッグ用途にも活用

---

### 4. 日記詳細画面 (`/diary/[date]`)

**目的**: 生成された日記と感情分析結果を表示

**主要機能**:
- 日記要約の表示
- AIインサイトの表示
- 感情データの可視化
- 録音回数などの統計情報

**データフロー**:
```
1. URLパラメータから日付を取得
   ↓
2. daily_summaries テーブルから該当日のデータを取得
   - formatted_text（日記要約）
   - ai_insights（AIインサイト）
   - avg_arousal, avg_valence, avg_dominance
   - total_recordings
   ↓
3. 画面表示
```

**使用テーブル**:
- `daily_summaries`

---

## データベーステーブル構成

### 主要テーブル

#### `recordings`
音声録音のメタデータ
```
- id: string (PK)
- user_id: string (FK)
- file_path: string (Supabase Storage path)
- duration: number (秒)
- created_at: timestamp
```

#### `transcription_segments`
文字起こしセグメント（句読点単位）
```
- id: string (PK)
- user_id: string (FK)
- recording_id: string (FK)
- segment_index: number
- text: string
- start_time: number (秒)
- end_time: number (秒)
- arousal: number | null
- valence: number | null
- dominance: number | null
- emotion_label: string | null
- created_at: timestamp
- updated_at: timestamp
```

#### `dialogue_turns`
AIとの対話履歴
```
- id: string (PK)
- user_id: string (FK)
- date: string (YYYY-MM-DD)
- role: 'user' | 'assistant'
- content: string
- input_type: 'text' | 'voice' | null
- recording_id: string | null (FK)
- order_index: number
- created_at: timestamp
```

#### `daily_summaries`
日次サマリー（日記）
```
- id: string (PK)
- user_id: string (FK)
- date: string (YYYY-MM-DD)
- transcription_text: string | null (全文字起こし)
- formatted_text: string | null (日記要約)
- avg_arousal: number | null
- avg_valence: number | null
- avg_dominance: number | null
- dominant_emotion: string | null
- emotion_distribution: JSON
- total_recordings: number
- total_duration_seconds: number
- ai_insights: string | null
- created_at: timestamp
- updated_at: timestamp
```

#### `emotion_analysis_results`
感情分析結果（録音単位）
```
- id: string (PK)
- recording_id: string (FK)
- user_id: string (FK)
- segments: JSON (EmotionSegment[])
- total_segments: number
- avg_arousal: number
- avg_valence: number
- avg_dominance: number
- dominant_emotion: string
- created_at: timestamp
- updated_at: timestamp
```

---

## API エンドポイント

### `/api/whisper-segmented` (POST)
**目的**: 音声ファイルから文字起こしとセグメント分割

**入力**:
```json
{
  "recordingId": "uuid",
  "filePath": "user_id/timestamp.webm"
}
```

**処理**:
1. Supabase Storageから音声ファイルをダウンロード
2. OpenAI Whisper APIで文字起こし（word-level timestamps）
3. GPT-4o-miniで句読点付与
4. 句読点で文単位に分割
5. `transcription_segments` に保存
6. `dialogue_turns` に保存（user）

**出力**:
```json
{
  "success": true,
  "text": "句読点付きの全文",
  "segments": [
    {
      "text": "セグメント1",
      "start": 0.0,
      "end": 1.5
    }
  ],
  "segmentCount": 5
}
```

---

### `/api/analyze-emotion-segmented` (POST)
**目的**: セグメント単位で感情分析

**入力**:
```json
{
  "recordingId": "uuid",
  "filePath": "user_id/timestamp.webm"
}
```

**処理**:
1. `transcription_segments` からセグメント情報を取得
2. 音声ファイルをダウンロード
3. 各セグメントの音声を切り出し（ffmpeg）
4. Pythonスクリプトで感情分析（VAD値）
5. `transcription_segments` を更新（arousal, valence, dominance, emotion_label）

**出力**:
```json
{
  "success": true,
  "analyzedSegments": 5,
  "totalSegments": 5,
  "segments": [
    {
      "segment_index": 0,
      "arousal": 3.8,
      "valence": 4.2,
      "dominance": 3.9,
      "emotion_label": "happy"
    }
  ]
}
```

---

### `/api/ai-chat` (POST)
**目的**: AI応答生成

**入力**:
```json
{
  "userMessage": "今日は仕事が忙しかった",
  "recordingId": "uuid"
}
```

**処理**:
1. 対話履歴を取得（`dialogue_turns`）
2. 感情分析結果を取得（`transcription_segments`）
3. GPT-4o-miniでプロンプト生成
   - 初回: 感情分析を重視
   - 2回目以降: 会話の流れを重視
4. AI応答を生成
5. `dialogue_turns` に保存（assistant）

**出力**:
```json
{
  "success": true,
  "response": "お疲れ様でした。忙しかったとのことですが、具体的にはどんなことがありましたか？"
}
```

---

### `/api/generate-summary` (POST)
**目的**: 日記要約とAIインサイトを生成

**入力**:
```json
{
  "date": "2025-11-26"
}
```

**処理**:
1. `daily_summaries` から既存データを取得
2. `dialogue_turns` から全会話を取得
3. `emotion_analysis_results` から感情データを取得
4. GPT-4o-miniで並列処理
   - 日記要約生成（150-200文字）
   - AIインサイト生成（80-120文字）
5. `daily_summaries` を更新

**出力**:
```json
{
  "success": true,
  "summary": {
    "date": "2025-11-26",
    "diarySummary": "今日は仕事が忙しく...",
    "aiInsights": "声のトーンから疲れが...",
    "emotionSummary": {
      "avgArousal": 3.5,
      "avgValence": 3.8,
      "avgDominance": 3.6
    }
  }
}
```

---

## 全体データフロー図

```
┌─────────────────┐
│ ダッシュボード  │
│  /dashboard     │
└────────┬────────┘
         │
         ├─ 今日の日記なし → /diary-chat へ
         └─ 過去の日記あり → /diary/[date] へ

┌──────────────────────────────────────────────────────┐
│ AIとの対話画面 /diary-chat                           │
└──────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │ 音声録音開始 │
  └──────┬───────┘
         │
         ▼
  ┌───────────────────────┐
  │ Supabase Storage      │ ← audio.webm
  │ recordings テーブル   │
  └──────┬────────────────┘
         │
         ▼
  ┌──────────────────────────────────┐
  │ /api/whisper-segmented           │
  │ 1. Whisper API (文字起こし)      │
  │ 2. GPT-4o-mini (句読点付与)      │
  │ 3. セグメント分割                │
  └──────┬───────────────────────────┘
         │
         ▼
  ┌─────────────────────────────┐
  │ transcription_segments      │ ← text, start_time, end_time
  │ dialogue_turns (user)       │ ← 全文
  └──────┬──────────────────────┘
         │
         ▼
  ┌────────────────────────────────────┐
  │ /api/analyze-emotion-segmented     │
  │ 1. 各セグメント音声を切り出し      │
  │ 2. Python感情分析（VAD値）        │
  └──────┬─────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────┐
  │ transcription_segments      │ ← arousal, valence, dominance
  │                             │   emotion_label
  └──────┬──────────────────────┘
         │
         ▼
  ┌──────────────────────┐
  │ UI更新               │ ← ユーザーメッセージ + 感情表示
  └──────┬───────────────┘
         │
         ▼
  ┌────────────────────────────────┐
  │ /api/ai-chat                   │
  │ 1. 対話履歴取得                │
  │ 2. 感情データ取得              │
  │ 3. GPT-4o-mini応答生成         │
  └──────┬─────────────────────────┘
         │
         ▼
  ┌─────────────────────────────┐
  │ dialogue_turns (assistant)  │ ← AI応答
  └──────┬──────────────────────┘
         │
         ▼
  ┌──────────────────────┐
  │ UI更新               │ ← AI応答表示
  └──────────────────────┘
         │
         │ (対話を繰り返す)
         │
         ▼
  ┌──────────────────────┐
  │ 日記生成ボタン押下   │
  └──────┬───────────────┘
         │
         ▼
  ┌────────────────────────────────┐
  │ /api/generate-summary          │
  │ 1. 全対話を取得                │
  │ 2. 感情データを集計            │
  │ 3. GPT-4o-mini並列処理         │
  │    - 日記要約                  │
  │    - AIインサイト              │
  └──────┬─────────────────────────┘
         │
         ▼
  ┌─────────────────────────────┐
  │ daily_summaries             │ ← formatted_text, ai_insights
  │                             │   avg_arousal, avg_valence, etc
  └──────┬──────────────────────┘
         │
         ▼
  ┌──────────────────────┐
  │ /diary/[date] へ     │
  └──────────────────────┘

┌─────────────────────────────────────────────��────────┐
│ 日記詳細画面 /diary/[date]                           │
│ - 日記要約表示                                        │
│ - AIインサイト表示                                    │
│ - 感情データ表示                                      │
└──────────────────────────────────────────────────────┘
```

---

## 感情分析について

### VAD値
- **Arousal（覚醒度）**: 0-5の範囲。低い=疲れ・落ち着き、高い=興奮・緊張
- **Valence（快度）**: 0-5の範囲。低い=ネガティブ、高い=ポジティブ
- **Dominance（優位性）**: 0-5の範囲。低い=受動的、高い=能動的

### 感情ラベル
VAD値から以下の感情ラベルに分類:
- `happy` - 幸せ
- `sad` - 悲しみ
- `angry` - 怒り
- `calm` - 穏やか
- `neutral` - 中立
- `excited` - 興奮
- `relaxed` - リラックス
- `stressed` - ストレス
- `tired` - 疲労

---

## 録音制限

- **1日の録音上限**: 5回（`DAILY_RECORDING_LIMIT = 5`）
- 各画面でリアルタイムに残り回数を表示
- 上限に達した場合は録音ボタンを無効化
- **1日に複数回の対話セッションが可能**
  - 例: 朝1回、昼2回、夜2回など、合計5回まで録音可能
  - 各録音ごとにAIとの対話が発生
  - 全ての対話は同じ日付（`date`）で`dialogue_turns`テーブルに記録
  - 最終的に全対話をまとめて1つの日記を生成（`/api/generate-summary`）
  - 日記生成は1日1回のみ（`daily_summaries`は日付ごとに1レコード）

---

## 技術スタック

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI/ML**:
  - OpenAI Whisper API (文字起こし)
  - GPT-4o-mini (句読点付与、AI応答、日記生成)
  - Python感情分析スクリプト (VAD値)
- **その他**: ffmpeg (音声切り出し)

---

## 今後の改善点

1. `emotion_analysis_results` テーブルの廃止検討（`transcription_segments`に統合済み）
2. リアルタイムストリーミング対応（Whisper, AI応答）
3. 感情推移グラフの追加
4. 週次・月次サマリー機能
5. 音声再生機能の強化（セグメント単位で再生）
