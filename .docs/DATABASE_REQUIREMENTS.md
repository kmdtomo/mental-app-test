# データベース要件定義

## 既存テーブル

### 1. `voice_recordings`
**目的**: 音声録音ファイルの管理

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID (PK) | レコードID |
| user_id | UUID (FK) | ユーザーID |
| file_path | TEXT | Storageのファイルパス |
| duration | INTEGER | 録音時間（秒） |
| created_at | TIMESTAMP | 作成日時 |

### 2. `transcriptions`
**目的**: 音声の文字起こし結果を保存

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | UUID (PK) | レコードID |
| user_id | UUID (FK) | ユーザーID |
| recording_id | UUID (FK) | 録音ID |
| original_text | TEXT | Whisperの文字起こし結果 |
| formatted_text | TEXT | Claude整形後のテキスト |
| created_at | TIMESTAMP | 作成日時 |

---

## 新規追加テーブル

### 3. `emotion_analysis_results`
**目的**: 音声録音ごとの感情分析詳細結果を保存

**リレーション**: voice_recordings (1対1)

| カラム名 | 型 | NULL | 説明 |
|---------|---|------|------|
| id | UUID (PK) | NO | レコードID |
| recording_id | UUID (FK) | NO | 録音ID（voice_recordings.id） |
| user_id | UUID (FK) | NO | ユーザーID |
| **total_segments** | INTEGER | NO | 検出された発話区間数 |
| **avg_arousal** | DECIMAL(10,6) | YES | 平均覚醒度 |
| **avg_valence** | DECIMAL(10,6) | YES | 平均快度 |
| **avg_dominance** | DECIMAL(10,6) | YES | 平均優位性 |
| **dominant_emotion** | VARCHAR(50) | YES | 主要な感情（happy/sad/angry等） |
| **segments** | JSONB | NO | セグメント詳細配列 |
| created_at | TIMESTAMP | NO | 作成日時 |
| updated_at | TIMESTAMP | NO | 更新日時 |

**segments JSONBの構造**:
```json
[
  {
    "segment_id": 1,
    "start": 1.282,
    "end": 4.222,
    "duration": 2.94,
    "arousal": 4.344,
    "valence": 4.538,
    "dominance": 4.303,
    "emotion": "happy"
  },
  {
    "segment_id": 2,
    ...
  }
]
```

**インデックス**:
- `recording_id` (高速検索用)
- `user_id` (ユーザーごとの検索)
- `created_at DESC` (時系列検索)

---

### 4. `daily_summaries`
**目的**: ユーザーごとの日次サマリー（日記 + 感情 + AI対話）

**制約**: 1ユーザー・1日につき1レコード（UNIQUE(user_id, date)）

| カラム名 | 型 | NULL | 説明 |
|---------|---|------|------|
| id | UUID (PK) | NO | レコードID |
| user_id | UUID (FK) | NO | ユーザーID |
| **date** | DATE | NO | 日付（YYYY-MM-DD） |
| **transcription_text** | TEXT | YES | その日の全文字起こし（結合） |
| **formatted_text** | TEXT | YES | 整形後のテキスト |
| **avg_arousal** | DECIMAL(10,6) | YES | その日の平均覚醒度 |
| **avg_valence** | DECIMAL(10,6) | YES | その日の平均快度 |
| **avg_dominance** | DECIMAL(10,6) | YES | その日の平均優位性 |
| **dominant_emotion** | VARCHAR(50) | YES | その日の主要な感情 |
| **emotion_distribution** | JSONB | NO | 感情分布 |
| **total_recordings** | INTEGER | NO | その日の録音回数 |
| **total_duration_seconds** | INTEGER | NO | その日の総録音時間 |
| **ai_conversation** | JSONB | NO | AI対話履歴 |
| **ai_insights** | TEXT | YES | AIが生成したインサイト |
| created_at | TIMESTAMP | NO | 作成日時 |
| updated_at | TIMESTAMP | NO | 更新日時 |

**emotion_distribution JSONBの構造**:
```json
{
  "happy": 12,
  "sad": 3,
  "angry": 1,
  "calm": 5,
  "neutral": 8,
  "excited": 4,
  "stressed": 2
}
```

**ai_conversation JSONBの構造**:
```json
[
  {
    "role": "assistant",
    "content": "今日は少し悲しそうに聞こえますが、何かありましたか？",
    "timestamp": "2025-11-01T10:30:00Z"
  },
  {
    "role": "user",
    "content": "実は友達と喧嘩してしまって...",
    "timestamp": "2025-11-01T10:31:15Z"
  },
  {
    "role": "assistant",
    "content": "それは辛かったですね。どんなことで喧嘩になったんですか？",
    "timestamp": "2025-11-01T10:31:20Z"
  }
]
```

**インデックス**:
- `(user_id, date DESC)` (ユーザーごとの日付検索)
- `date DESC` (全体の日付検索)

---

## テーブル間のリレーション

```
auth.users
    │
    ├─→ voice_recordings (1:N)
    │       │
    │       ├─→ emotion_analysis_results (1:1)
    │       │
    │       └─→ transcriptions (1:1)
    │
    └─→ daily_summaries (1:N, 1日1レコード)
```

---

## データ保存フロー

### 録音時
```
1. voice_recordings に保存
2. transcriptions に文字起こし結果を保存
3. emotion_analysis_results に感情分析結果を保存
```

### AI対話完了時
```
4. daily_summaries を作成 or 更新
   - その日の全transcriptionを結合
   - その日の全emotion_analysis_resultsから平均値を計算
   - AI対話履歴を保存
```

### サマリー表示時
```
5. daily_summaries から指定日のデータを取得
6. UIに表示（日記 + 感情グラフ + AI対話）
```

---

## 必須カラムのまとめ

### emotion_analysis_results（感情分析結果）
**必須**:
- `recording_id` - 録音との紐付け
- `user_id` - ユーザー識別
- `total_segments` - セグメント数
- `avg_arousal`, `avg_valence`, `avg_dominance` - VAD平均値
- `segments` - セグメント詳細（JSONB）

**オプション**:
- `dominant_emotion` - 主要感情（計算可能）

### daily_summaries（日次サマリー）
**必須**:
- `user_id` - ユーザー識別
- `date` - 日付（UNIQUE制約）
- `ai_conversation` - AI対話履歴（空配列でもOK）

**重要**:
- `transcription_text` - その日の日記テキスト
- `avg_arousal`, `avg_valence`, `avg_dominance` - 感情総評
- `emotion_distribution` - 感情分布
- `total_recordings` - 録音回数

**後で追加**:
- `ai_insights` - AI対話後に生成

---

## セキュリティ要件

### RLS (Row Level Security)
**すべてのテーブルで必須**:
- ユーザーは自分のデータのみアクセス可能
- SELECT/INSERT/UPDATE/DELETE すべてにポリシー設定

### データプライバシー
- 音声ファイル: Supabase Storage（Private）
- 文字起こし: 暗号化推奨
- 感情データ: RLSで保護
- AI対話履歴: 個人情報として厳重管理

---

## 次のアクション

1. **マイグレーションSQL確認** → Supabaseで実行
2. **型定義の統合** → 既存コードに適用
3. **APIエンドポイント作成** → 感情分析結果の保存
4. **動作確認** → テストデータで検証

**準備完了後、Phase 2（AI対話）に進む**
