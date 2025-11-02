# データルール仕様書

## 概要
このドキュメントは、メンタルアップテスト（音声日記アプリ）におけるデータ保存・管理のルールを定義します。

---

## テーブル構成と責務

### 1. **voice_recordings**（音声録音）
**責務**: 音声ファイルのメタデータ管理

**粒度**: 1録音 = 1レコード

**保存タイミング**: 録音完了直後

**データ**:
- 音声ファイルパス（Supabase Storage）
- 録音時間
- ユーザーID

**ライフサイクル**: 録音 → 保存 → 永続化

---

### 2. **emotion_analysis_results**（感情分析結果）
**責務**: 1回の録音に対する感情分析の全データ保存

**粒度**: 1録音 = 1レコード（voice_recordings と 1:1）

**保存タイミング**: 感情分析完了直後

**データ構造**:
```json
{
  "recording_id": "xxx",
  "user_id": "xxx",
  "segments": [
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
  ],
  "summary": {
    "total_segments": 5,
    "avg_arousal": 4.2,
    "avg_valence": 4.3,
    "avg_dominance": 4.1,
    "dominant_emotion": "happy"
  }
}
```

**ルール**:
- `segments`: VAD分割された全セグメントの詳細データ（配列）
- `summary`: その録音全体の総評（1オブジェクト）
- 1録音につき1つのみ（UNIQUE制約）

**ライフサイクル**: 録音 → VAD分割 → 各セグメント分析 → 総評計算 → 保存

---

### 3. **dialogue_turns**（AI対話）
**責務**: AI対話の各発言を1レコードずつ保存

**粒度**: 1発言（ユーザーまたはAI）= 1レコード

**保存タイミング**:
- ユーザー発言時: 即座に保存
- AI応答時: OpenAI APIレスポンス受信後に保存

**データ構造**:
```
// ユーザーが音声で入力した場合
{
  "user_id": "xxx",
  "date": "2025-11-01",
  "role": "user",
  "content": "今日は友達と喧嘩してしまって...",
  "input_type": "voice",
  "recording_id": "recording-uuid",
  "order_index": 1
}

// ユーザーがテキストで入力した場合
{
  "user_id": "xxx",
  "date": "2025-11-01",
  "role": "user",
  "content": "大丈夫です",
  "input_type": "text",
  "recording_id": NULL,
  "order_index": 3
}

// AI応答の場合
{
  "user_id": "xxx",
  "date": "2025-11-01",
  "role": "assistant",
  "content": "それは辛かったですね。どんなことがあったんですか？",
  "input_type": NULL,
  "recording_id": NULL,
  "order_index": 2
}
```

**NULL制約ルール**:
| role | input_type | recording_id | ルール |
|------|-----------|--------------|--------|
| `user` | `voice` | UUID | 音声入力の場合、recording_id必須 |
| `user` | `text` | NULL | テキスト入力の場合、recording_id不要 |
| `assistant` | NULL | NULL | AI応答は両方必ずNULL |

**順序管理**:
- `order_index`: その日の対話内での発言順序（1から開始）
- 同じ日付内でorder_indexでソートすることで対話を再構成

**ライフサイクル**:
- ユーザー発言 → 保存
- OpenAI API呼び出し
- AI応答 → 保存
- （繰り返し）

---

### 4. **daily_summaries**（日次サマリー）
**責務**: その日全体の統合データ（全録音 + 全対話の集計）

**粒度**: 1日 = 1レコード（ユーザーごと、UNIQUE制約）

**保存タイミング**:
- 初回: その日最初の録音後に作成
- 更新: 録音ごと、対話完了時に更新
- 最終更新: その日の終わり（AI insights生成）

**データ構造**:
```json
{
  "user_id": "xxx",
  "date": "2025-11-01",

  // テキストデータ
  "transcription_text": "今日は友達と喧嘩して...大丈夫です...",
  "formatted_text": "整形後のテキスト",

  // 感情統合データ（全録音の平均）
  "avg_arousal": 4.1,
  "avg_valence": 4.2,
  "avg_dominance": 4.0,
  "dominant_emotion": "happy",

  // 感情分布（全セグメントの集計）
  "emotion_distribution": {
    "happy": 12,
    "sad": 3,
    "angry": 1,
    "calm": 5,
    "neutral": 8
  },

  // メタデータ
  "total_recordings": 3,
  "total_duration_seconds": 180,

  // AI対話から生成
  "ai_insights": "今日は全体的に前向きな気持ちでしたが、友人関係で悩んでいる様子が見られました..."
}
```

**計算ルール**:

#### transcription_text
```sql
-- その日の全dialogue_turnsから生成
SELECT string_agg(content, ' ')
FROM dialogue_turns
WHERE user_id = xxx
  AND date = '2025-11-01'
  AND role = 'user'
ORDER BY order_index;
```

#### avg_arousal, avg_valence, avg_dominance
```sql
-- その日の全emotion_analysis_resultsの平均
SELECT
  AVG((summary->>'avg_arousal')::DECIMAL) as avg_arousal,
  AVG((summary->>'avg_valence')::DECIMAL) as avg_valence,
  AVG((summary->>'avg_dominance')::DECIMAL) as avg_dominance
FROM emotion_analysis_results
WHERE user_id = xxx
  AND DATE(created_at) = '2025-11-01';
```

#### emotion_distribution
```sql
-- その日の全emotion_analysis_resultsの全segmentsから集計
-- 各セグメントのemotionをカウント
{
  "happy": COUNT(emotion='happy'),
  "sad": COUNT(emotion='sad'),
  ...
}
```

**ライフサイクル**:
1. 初回録音 → daily_summariesレコード作成（基本情報のみ）
2. 追加録音 → 感情データ更新
3. AI対話完了 → ai_insights生成・保存
4. 日付変更 → そのまま保持（履歴）

---

## データフロー

### 録音から保存まで

```
1. ユーザーが音声録音
   ↓
2. voice_recordings に保存
   recording_id = "rec-001"
   ↓
3. VAD分割 + 感情分析実行
   ↓
4. emotion_analysis_results に保存
   {
     recording_id: "rec-001",
     segments: [seg1, seg2, seg3, ...],
     summary: {total_segments: 5, avg_arousal: 4.2, ...}
   }
   ↓
5. daily_summaries を作成 or 更新
   - その日の全emotion_analysis_resultsを集計
   - avg_arousal, avg_valence等を再計算
   - emotion_distributionを更新
```

### AI対話の保存

```
1. ユーザーが音声で質問（または初回AI起動）
   recording_id = "rec-001"
   ↓
2. dialogue_turns に保存（ユーザー発言）
   {
     date: "2025-11-01",
     role: "user",
     input_type: "voice",
     recording_id: "rec-001",
     content: "今日は友達と喧嘩した",
     order_index: 1
   }
   ↓
3. OpenAI API呼び出し
   - dialogue_turnsから当日の全発言を取得
   - コンテキストとして送信
   ↓
4. AI応答を dialogue_turns に保存
   {
     date: "2025-11-01",
     role: "assistant",
     input_type: NULL,
     recording_id: NULL,
     content: "それは辛かったですね...",
     order_index: 2
   }
   ↓
5. ユーザーがテキストで返信
   ↓
6. dialogue_turns に保存
   {
     role: "user",
     input_type: "text",
     recording_id: NULL,
     content: "些細なことだったんですけど...",
     order_index: 3
   }
   ↓
7. （対話を繰り返し: 3〜5ターン）
   ↓
8. 対話完了後、daily_summaries の ai_insights を生成・更新
```

---

## データ取得パターン

### パターン1: 特定の録音の詳細を取得
```typescript
// 録音 + 文字起こし + 感情分析
const { data } = await supabase
  .from('voice_recordings')
  .select(`
    *,
    emotion_analysis_results (
      segments,
      summary
    ),
    dialogue_turns!recording_id (
      content,
      role
    )
  `)
  .eq('id', recordingId)
  .single();
```

### パターン2: その日の全対話を取得
```typescript
const { data } = await supabase
  .from('dialogue_turns')
  .select('*')
  .eq('user_id', userId)
  .eq('date', '2025-11-01')
  .order('order_index', { ascending: true });

// OpenAI APIに渡す形式に変換
const messages = data.map(turn => ({
  role: turn.role,
  content: turn.content
}));
```

### パターン3: その日のサマリーを取得
```typescript
const { data } = await supabase
  .from('daily_summaries')
  .select('*')
  .eq('user_id', userId)
  .eq('date', '2025-11-01')
  .single();

// 感情分布をグラフ化
const emotions = data.emotion_distribution;
```

---

## データ整合性ルール

### ルール1: recording_idの参照整合性
```
voice_recordings.id
    ↓ FK
emotion_analysis_results.recording_id (UNIQUE, NOT NULL)
    ↓ FK (NULL可)
dialogue_turns.recording_id (userでvoiceの場合のみNOT NULL)
```

### ルール2: daily_summariesの集計整合性
```
daily_summaries.avg_arousal =
  AVG(emotion_analysis_results.summary.avg_arousal)
  WHERE date = daily_summaries.date

daily_summaries.emotion_distribution =
  COUNT(各emotion) FROM emotion_analysis_results.segments
  WHERE date = daily_summaries.date
```

### ルール3: dialogue_turnsの順序整合性
```
同じ(user_id, date)内で:
  order_index は1から開始
  連番である必要はない（削除時のギャップOK）
  order_indexでソートすることで対話を再構成
```

---

## NULL値のルール

### emotion_analysis_results
| カラム | NULL許可 | 条件 |
|-------|---------|------|
| recording_id | NO | 必須 |
| segments | NO | 最低でも空配列 `[]` |
| summary | NO | 最低でも空オブジェクト `{}` |
| avg_arousal, avg_valence, avg_dominance | YES | セグメントがない場合NULL |

### dialogue_turns
| カラム | NULL許可 | 条件 |
|-------|---------|------|
| date | NO | 必須 |
| role | NO | 'user' or 'assistant' |
| content | NO | 空文字列も許可（最低でも""） |
| input_type | YES | assistantは必ずNULL |
| recording_id | YES | assistantまたはtextは必ずNULL |

**制約**:
- `role = 'assistant'` → `input_type = NULL` AND `recording_id = NULL`
- `role = 'user' AND input_type = 'voice'` → `recording_id IS NOT NULL`
- `role = 'user' AND input_type = 'text'` → `recording_id = NULL`

### daily_summaries
| カラム | NULL許可 | 条件 |
|-------|---------|------|
| date | NO | 必須 |
| transcription_text | YES | 録音がない日はNULL |
| avg_arousal, avg_valence, avg_dominance | YES | 録音がない日はNULL |
| emotion_distribution | NO | 最低でも空オブジェクト `{}` |
| ai_insights | YES | AI対話完了前はNULL |

---

## データ更新ルール

### emotion_analysis_results
**作成**: 録音1回につき1回のみ
**更新**: 基本的に不可（再分析が必要な場合のみ）
**削除**: recording削除時にカスケード削除

### dialogue_turns
**作成**: 発言ごとに追加（INSERT）
**更新**: 基本的に不可（typo修正のみ許可）
**削除**: 個別削除可能、daily_summariesには影響しない

### daily_summaries
**作成**: その日最初の録音時に自動作成
**更新**:
  - 録音追加時: 感情データを再計算して更新
  - 対話完了時: ai_insightsを生成して更新
**削除**: 手動削除のみ（カスケードなし）

---

## JSONB構造の詳細仕様

### emotion_analysis_results.segments
**型**: JSONB配列

**必須フィールド**:
```typescript
{
  segment_id: number;      // 1から開始の連番
  start: number;           // 開始時間（秒）
  end: number;             // 終了時間（秒）
  duration: number;        // 長さ（秒）
  arousal: number;         // 覚醒度（VAD値）
  valence: number;         // 快度（VAD値）
  dominance: number;       // 優位性（VAD値）
  emotion: string;         // 推定感情（happy/sad/angry等）
}
```

**検証ルール**:
- segment_idは連番
- start < end
- duration = end - start
- VAD値は数値型

### emotion_analysis_results.summary
**型**: JSONBオブジェクト

**必須フィールド**:
```typescript
{
  total_segments: number;      // セグメント総数
  avg_arousal: number;         // 平均覚醒度
  avg_valence: number;         // 平均快度
  avg_dominance: number;       // 平均優位性
  dominant_emotion: string;    // 主要な感情
}
```

**計算方法**:
```
avg_arousal = AVERAGE(segments[].arousal)
avg_valence = AVERAGE(segments[].valence)
avg_dominance = AVERAGE(segments[].dominance)
dominant_emotion = VAD→感情マッピング関数(avg_arousal, avg_valence, avg_dominance)
```

### daily_summaries.emotion_distribution
**型**: JSONBオブジェクト

**構造**:
```typescript
{
  happy?: number;      // happy感情のセグメント数
  sad?: number;        // sad感情のセグメント数
  angry?: number;      // angry感情のセグメント数
  calm?: number;
  neutral?: number;
  excited?: number;
  relaxed?: number;
  stressed?: number;
  tired?: number;
}
```

**計算方法**:
```typescript
// その日の全emotion_analysis_resultsの全segmentsから集計
const distribution = {};
for (const result of emotionResults) {
  for (const segment of result.segments) {
    distribution[segment.emotion] = (distribution[segment.emotion] || 0) + 1;
  }
}
```

---

## セキュリティルール（RLS）

### 基本原則
**全テーブル**: ユーザーは自分のデータのみアクセス可能

**条件**: `auth.uid() = user_id`

**適用操作**: SELECT, INSERT, UPDATE, DELETE

### 外部キー参照時のルール
```
dialogue_turns.recording_id → voice_recordings.id
  ↓
recording_idがNULLでない場合、そのvoice_recordingも同じユーザーのものである必要がある
（FK制約で自動的に保証される）
```

---

## データ削除ルール

### カスケード削除
```
voice_recordings 削除
  ↓ ON DELETE CASCADE
  ├─→ emotion_analysis_results 自動削除
  └─→ dialogue_turns.recording_id を NULL に設定（ON DELETE SET NULL）

auth.users 削除
  ↓ ON DELETE CASCADE
  ├─→ voice_recordings 自動削除
  ├─→ emotion_analysis_results 自動削除
  ├─→ dialogue_turns 自動削除
  └─→ daily_summaries 自動削除
```

### 論理削除 vs 物理削除
**現在**: 物理削除（実際にレコードを削除）

**将来的に検討**:
- deleted_atカラム追加
- ソフトデリート（論理削除）
- データ保持期間の設定

---

## バリデーションルール

### アプリケーション層でのチェック（INSERT前）

**emotion_analysis_results**:
```typescript
// segments配列が空でないこと
if (!segments || segments.length === 0) {
  throw new Error('Segments cannot be empty');
}

// summaryの必須フィールドチェック
if (!summary.total_segments || !summary.avg_arousal) {
  throw new Error('Invalid summary data');
}

// total_segmentsの整合性
if (summary.total_segments !== segments.length) {
  throw new Error('Segment count mismatch');
}
```

**dialogue_turns**:
```typescript
// roleチェック
if (!['user', 'assistant'].includes(role)) {
  throw new Error('Invalid role');
}

// NULL制約チェック
if (role === 'assistant' && (input_type !== null || recording_id !== null)) {
  throw new Error('Assistant must not have input_type or recording_id');
}

if (role === 'user' && input_type === 'voice' && !recording_id) {
  throw new Error('Voice input must have recording_id');
}
```

---

## パフォーマンス考慮事項

### インデックス戦略
- **よく使う検索**: user_id + date
- **時系列取得**: created_at DESC
- **外部キー**: recording_id

### JSONB検索の最適化
```sql
-- emotion_distributionから特定の感情を検索
SELECT * FROM daily_summaries
WHERE (emotion_distribution->>'happy')::int > 10;

-- 必要に応じてGINインデックス追加
CREATE INDEX idx_daily_summaries_emotion_dist ON daily_summaries USING GIN (emotion_distribution);
```

---

## データ容量見積もり

### 1ユーザー・1ヶ月あたり

**前提**:
- 1日1回録音（30秒）
- 1日1回AI対話（5ターン）

**テーブルサイズ**:
```
voice_recordings: 30レコード × 100バイト = 3KB
emotion_analysis_results: 30レコード × 2KB (JSONB) = 60KB
dialogue_turns: 30日 × 10ターン × 200バイト = 60KB
daily_summaries: 30レコード × 1KB = 30KB

合計: 約150KB/月/ユーザー
```

**100ユーザーで**: 15MB/月（非常に軽量）

---

## トラブルシューティング

### Q: emotion_analysis_resultsが保存されない
**確認事項**:
- recording_idが存在するか
- segmentsが空配列でないか
- RLSポリシーが有効か

### Q: dialogue_turnsの順序がおかしい
**確認事項**:
- order_indexが正しく設定されているか
- 同じdateでソートしているか

### Q: daily_summariesの集計値が合わない
**確認事項**:
- その日のemotion_analysis_resultsが全て保存されているか
- 日付のタイムゾーンが一致しているか

---

## 今後の拡張

### Phase 2以降で追加検討
- **週次サマリー**: weekly_summariesテーブル
- **月次サマリー**: monthly_summariesテーブル
- **感情トレンド分析**: emotion_trendsテーブル
- **AIフィードバック**: ai_feedbackテーブル

---

**最終更新**: 2025年11月1日
**バージョン**: 3.0
**ステータス**: 確定
