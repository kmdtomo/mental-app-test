# 既存機能から新テーブルへの移行マッピング

## 現在の機能フロー

### 現在の実装
```
1. ユーザーが音声録音
   ↓
2. voice_recordings に保存
   ↓
3. Whisper API で文字起こし
   ↓
4. transcriptions に保存
   ↓
5. 感情分析実行
   ↓
6. （結果を保存する場所がない - フロントエンドで一時表示のみ）
```

---

## 新しい機能フロー（移行後）

### 修正後の実装
```
1. ユーザーが音声録音
   ↓
2. voice_recordings に保存
   ↓
3. Whisper API で文字起こし + 感情分析（並列実行）
   ↓
4. emotion_analysis_results に保存（NEW）
   {
     recording_id,
     segments: [...],
     summary: {...}
   }
   ↓
5. dialogue_turns に保存（NEW）
   {
     role: 'user',
     input_type: 'voice',
     recording_id: xxx,
     content: "文字起こし結果"
   }
   ↓
6. daily_summaries を作成 or 更新（NEW）
```

---

## 機能ごとの詳細マッピング

### 機能1: 音声録音・保存
**ファイル**: `app/api/upload-audio/route.ts`

**現在**:
```typescript
// voice_recordingsに保存
const { data: recording } = await supabase
  .from('voice_recordings')
  .insert({
    user_id: user.id,
    file_path: fileName,
    duration: 0
  });
```

**変更**: なし（そのまま使用）

**使用テーブル**:
- ✅ `voice_recordings`

---

### 機能2: 文字起こし
**ファイル**: `app/api/whisper/route.ts`

**現在**:
```typescript
// Whisper API実行
const transcription = await openai.audio.transcriptions.create({...});

// transcriptionsに保存
await supabase.from('transcriptions').insert({
  user_id: user.id,
  recording_id: recordingId,
  original_text: transcriptionText,
  formatted_text: ''
});
```

**変更後**:
```typescript
// Whisper API実行（同じ）
const transcription = await openai.audio.transcriptions.create({...});

// ❌ transcriptionsテーブルは削除
// ✅ dialogue_turnsに保存（ユーザー発言として）
await supabase.from('dialogue_turns').insert({
  user_id: user.id,
  date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  role: 'user',
  content: transcriptionText,
  input_type: 'voice',
  recording_id: recordingId,
  order_index: await getNextOrderIndex(user.id, date)
});

// ✅ daily_summariesを更新
await updateDailySummary(user.id, date, transcriptionText);
```

**使用テーブル**:
- ❌ ~~transcriptions~~（削除）
- ✅ `dialogue_turns`（NEW）
- ✅ `daily_summaries`（NEW）

---

### 機能3: 感情分析
**ファイル**: `app/api/analyze-emotion/route.ts`

**現在**:
```typescript
// Python実行
const emotionResult = JSON.parse(jsonLine);
// {
//   file: '/tmp/audio_xxx.wav',
//   segments: [...],
//   summary: {...}
// }

// ✅ フロントエンドに返すだけ（DBに保存していない）
return NextResponse.json({
  success: true,
  emotion: emotionResult
});
```

**変更後**:
```typescript
// Python実行（同じ）
const emotionResult = JSON.parse(jsonLine);

// ✅ emotion_analysis_resultsに保存（NEW）
await supabase.from('emotion_analysis_results').insert({
  recording_id: recordingId,
  user_id: user.id,
  segments: emotionResult.segments,
  summary: emotionResult.summary
});

// ✅ daily_summariesを更新（感情データを再計算）
await updateDailySummaryEmotions(user.id, date);

// フロントエンドに返す
return NextResponse.json({
  success: true,
  emotion: emotionResult
});
```

**使用テーブル**:
- ✅ `emotion_analysis_results`（NEW - データ永続化）
- ✅ `daily_summaries`（NEW - 日次集計更新）

---

### 機能4: UI表示
**ファイル**: `views/VoiceDiaryPage.tsx`

**現在**:
```typescript
// フロントエンドのstateで一時的に保持
const [emotionResult, setEmotionResult] = useState(...);
const [transcription, setTranscription] = useState(...);

// ページリロードすると消える
```

**変更後**:
```typescript
// ✅ DBから取得して表示（永続化されている）
const { data: recording } = await supabase
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

// 表示
setEmotionResult(recording.emotion_analysis_results);
setTranscription(recording.dialogue_turns.find(t => t.role === 'user')?.content);
```

**使用テーブル**:
- ✅ `emotion_analysis_results`（感情データ取得）
- ✅ `dialogue_turns`（文字起こし取得）

---

## API修正が必要なファイル

### 1. `/app/api/whisper/route.ts`
**修正内容**:
- ❌ `transcriptions`への保存を削除
- ✅ `dialogue_turns`への保存を追加
- ✅ `daily_summaries`の作成 or 更新を追加

**変更箇所**:
```typescript
// 削除
await supabase.from('transcriptions').insert({...});

// 追加
await supabase.from('dialogue_turns').insert({
  user_id,
  date: new Date().toISOString().split('T')[0],
  role: 'user',
  content: transcriptionText,
  input_type: 'voice',
  recording_id,
  order_index: 1 // またはgetNextOrderIndex()
});
```

### 2. `/app/api/analyze-emotion/route.ts`
**修正内容**:
- ✅ `emotion_analysis_results`への保存を追加
- ✅ `daily_summaries`の感情データ更新を追加

**変更箇所**:
```typescript
// 追加
await supabase.from('emotion_analysis_results').insert({
  recording_id,
  user_id,
  segments: emotionResult.segments,
  summary: emotionResult.summary
});

// daily_summariesの更新
await updateDailySummaryEmotions(user.id, date);
```

### 3. `/app/api/format-text/route.ts`
**修正内容**:
- ❌ `transcriptions`の更新を削除
- ✅ `dialogue_turns`のcontentを更新（formatted版）

**変更箇所**:
```typescript
// 削除
await supabase.from('transcriptions')
  .update({ formatted_text: formattedText })
  .eq('id', transcriptionId);

// 追加（オプション）
await supabase.from('dialogue_turns')
  .update({ content: formattedText })
  .eq('recording_id', recordingId)
  .eq('role', 'user');

// またはdaily_summariesのformatted_textを更新
await supabase.from('daily_summaries')
  .update({ formatted_text: formattedText })
  .eq('user_id', user.id)
  .eq('date', date);
```

---

## 新規作成が必要なヘルパー関数

### 1. `getNextOrderIndex(userId: string, date: string): Promise<number>`
**目的**: その日の次のorder_indexを取得

```typescript
// lib/db/dialogue.ts
export async function getNextOrderIndex(userId: string, date: string): Promise<number> {
  const { data } = await supabase
    .from('dialogue_turns')
    .select('order_index')
    .eq('user_id', userId)
    .eq('date', date)
    .order('order_index', { ascending: false })
    .limit(1)
    .single();

  return (data?.order_index || 0) + 1;
}
```

### 2. `updateDailySummaryEmotions(userId: string, date: string): Promise<void>`
**目的**: その日の全録音から感情データを再計算してdaily_summariesを更新

```typescript
// lib/db/dailySummary.ts
export async function updateDailySummaryEmotions(userId: string, date: string) {
  // その日の全emotion_analysis_resultsを取得
  const { data: emotionResults } = await supabase
    .from('emotion_analysis_results')
    .select(`
      summary,
      segments,
      voice_recordings!inner(created_at)
    `)
    .eq('user_id', userId)
    .gte('voice_recordings.created_at', `${date}T00:00:00`)
    .lt('voice_recordings.created_at', `${date}T23:59:59`);

  if (!emotionResults || emotionResults.length === 0) return;

  // 平均値計算
  const avgArousal = average(emotionResults.map(r => r.summary.avg_arousal));
  const avgValence = average(emotionResults.map(r => r.summary.avg_valence));
  const avgDominance = average(emotionResults.map(r => r.summary.avg_dominance));

  // 感情分布計算
  const emotionDistribution = {};
  emotionResults.forEach(result => {
    result.segments.forEach(seg => {
      emotionDistribution[seg.emotion] = (emotionDistribution[seg.emotion] || 0) + 1;
    });
  });

  // dominant_emotion計算
  const dominantEmotion = Object.entries(emotionDistribution)
    .sort((a, b) => b[1] - a[1])[0][0];

  // daily_summariesを upsert
  await supabase.from('daily_summaries').upsert({
    user_id: userId,
    date,
    avg_arousal: avgArousal,
    avg_valence: avgValence,
    avg_dominance: avgDominance,
    dominant_emotion: dominantEmotion,
    emotion_distribution: emotionDistribution,
    total_recordings: emotionResults.length
  }, {
    onConflict: 'user_id,date'
  });
}
```

### 3. `updateDailySummaryText(userId: string, date: string): Promise<void>`
**目的**: その日の全dialogue_turnsから文字起こしテキストを結合

```typescript
export async function updateDailySummaryText(userId: string, date: string) {
  const { data: turns } = await supabase
    .from('dialogue_turns')
    .select('content')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('role', 'user')
    .order('order_index', { ascending: true });

  const transcriptionText = turns?.map(t => t.content).join(' ') || '';

  await supabase.from('daily_summaries').upsert({
    user_id: userId,
    date,
    transcription_text: transcriptionText
  }, {
    onConflict: 'user_id,date'
  });
}
```

---

## 修正が必要なファイル一覧

### 必須修正
1. ✅ `/app/api/whisper/route.ts` - transcriptions → dialogue_turns
2. ✅ `/app/api/analyze-emotion/route.ts` - emotion_analysis_results保存追加
3. ✅ `/app/api/format-text/route.ts` - transcriptions → daily_summaries

### 新規作成
4. ✅ `/lib/db/dialogue.ts` - dialogue_turns操作関数
5. ✅ `/lib/db/dailySummary.ts` - daily_summaries操作関数
6. ✅ `/lib/db/emotionAnalysis.ts` - emotion_analysis_results操作関数

### 削除
7. ❌ transcriptions関連の全てのコード

---

## テーブル使用マトリクス

| 機能 | voice_recordings | emotion_analysis_results | dialogue_turns | daily_summaries |
|------|-----------------|-------------------------|----------------|-----------------|
| 音声録音 | INSERT | - | - | - |
| 文字起こし | - | - | INSERT (user) | UPDATE (text) |
| 感情分析 | - | INSERT | - | UPDATE (emotions) |
| AI対話開始 | - | - | INSERT (assistant) | - |
| AI対話継続 | - | - | INSERT (user/assistant) | - |
| AI対話完了 | - | - | - | UPDATE (ai_insights) |
| サマリー表示 | SELECT | - | - | SELECT |
| 録音履歴表示 | SELECT | SELECT | SELECT | - |

---

## データの流れ（詳細）

### フロー1: 録音完了時
```typescript
// Step 1: upload-audio API
POST /api/upload-audio
  ↓
voice_recordings.insert({
  user_id,
  file_path,
  duration
})
  ↓ recording_id取得
return { recordingId }

// Step 2: whisper API (並列実行)
POST /api/whisper
  ↓
Whisper API実行
  ↓
dialogue_turns.insert({
  user_id,
  date: TODAY,
  role: 'user',
  content: transcriptionText,
  input_type: 'voice',
  recording_id,
  order_index: getNextOrderIndex()
})
  ↓
daily_summaries.upsert({
  user_id,
  date: TODAY,
  transcription_text: aggregateAllUserTurns()
})

// Step 3: analyze-emotion API (並列実行)
POST /api/analyze-emotion
  ↓
Python感情分析実行
  ↓
emotion_analysis_results.insert({
  recording_id,
  user_id,
  segments: [...],
  summary: {...}
})
  ↓
daily_summaries.upsert({
  user_id,
  date: TODAY,
  avg_arousal: recalculateAverage(),
  avg_valence: recalculateAverage(),
  avg_dominance: recalculateAverage(),
  emotion_distribution: recalculateDistribution(),
  total_recordings: countRecordings()
})
```

### フロー2: AI対話時（将来実装）
```typescript
POST /api/ai-chat
  ↓
// ユーザー発言を保存（テキスト入力の場合）
dialogue_turns.insert({
  user_id,
  date: TODAY,
  role: 'user',
  content: userMessage,
  input_type: 'text',
  recording_id: NULL,
  order_index: getNextOrderIndex()
})
  ↓
// その日の対話履歴を取得
const history = dialogue_turns
  .select('role, content')
  .eq('user_id', userId)
  .eq('date', TODAY)
  .order('order_index')
  ↓
// OpenAI API呼び出し
const aiResponse = await openai.chat.completions.create({
  messages: history
})
  ↓
// AI応答を保存
dialogue_turns.insert({
  user_id,
  date: TODAY,
  role: 'assistant',
  content: aiResponse.content,
  input_type: NULL,
  recording_id: NULL,
  order_index: getNextOrderIndex()
})
```

---

## 既存コードの削除箇所

### 削除するコード

**1. transcriptionsへのINSERT**
```typescript
// ❌ 削除
await supabase.from('transcriptions').insert({
  user_id: user.id,
  recording_id: recordingId,
  original_text: transcriptionText,
  formatted_text: ''
});
```

**2. transcriptionsからのSELECT**
```typescript
// ❌ 削除
const { data } = await supabase
  .from('transcriptions')
  .select('*')
  .eq('recording_id', recordingId);
```

**3. transcriptionsのUPDATE**
```typescript
// ❌ 削除
await supabase.from('transcriptions')
  .update({ formatted_text: formattedText })
  .eq('id', transcriptionId);
```

---

## 新規追加するコード

### 1. emotion_analysis_resultsへの保存
**場所**: `app/api/analyze-emotion/route.ts`

```typescript
// 感情分析結果をDBに保存
const { error: emotionDbError } = await supabase
  .from('emotion_analysis_results')
  .insert({
    recording_id: recordingId,
    user_id: user.id,
    segments: emotionResult.segments,
    summary: emotionResult.summary
  });

if (emotionDbError) {
  console.error('Failed to save emotion analysis:', emotionDbError);
  // エラーでもフロントには結果を返す（保存は失敗してもOK）
}
```

### 2. dialogue_turnsへの保存
**場所**: `app/api/whisper/route.ts`

```typescript
import { getNextOrderIndex } from '@/lib/db/dialogue';

// 文字起こし結果をdialogue_turnsに保存
const date = new Date().toISOString().split('T')[0];
const orderIndex = await getNextOrderIndex(user.id, date);

const { error: dialogueError } = await supabase
  .from('dialogue_turns')
  .insert({
    user_id: user.id,
    date: date,
    role: 'user',
    content: transcriptionText,
    input_type: 'voice',
    recording_id: recordingId,
    order_index: orderIndex
  });
```

### 3. daily_summariesの更新
**場所**: `app/api/analyze-emotion/route.ts`（感情分析後）

```typescript
import { updateDailySummaryEmotions } from '@/lib/db/dailySummary';

// 感情分析後、daily_summariesを更新
const date = new Date().toISOString().split('T')[0];
await updateDailySummaryEmotions(user.id, date);
```

---

## 型定義の更新

### 削除する型
```typescript
// ❌ 削除
interface Transcription {
  id: string;
  user_id: string;
  recording_id: string;
  original_text: string;
  formatted_text: string;
}
```

### 追加する型
```typescript
// ✅ 追加（types/database.ts）
interface DialogueTurn {
  id: string;
  user_id: string;
  date: string;
  role: 'user' | 'assistant';
  content: string;
  input_type: 'text' | 'voice' | null;
  recording_id: string | null;
  order_index: number;
  created_at: string;
}

interface EmotionAnalysisResult {
  id: string;
  recording_id: string;
  user_id: string;
  segments: EmotionSegment[];
  summary: EmotionSummary;
  created_at: string;
  updated_at: string;
}
```

---

## 移行チェックリスト

### Phase 1: データベース
- [ ] マイグレーションSQL実行
- [ ] テーブル作成確認
- [ ] RLS動作確認

### Phase 2: ヘルパー関数作成
- [ ] `lib/db/dialogue.ts` 作成
- [ ] `lib/db/dailySummary.ts` 作成
- [ ] `lib/db/emotionAnalysis.ts` 作成

### Phase 3: API修正
- [ ] `whisper/route.ts` 修正
- [ ] `analyze-emotion/route.ts` 修正
- [ ] `format-text/route.ts` 修正（オプション）

### Phase 4: 型定義更新
- [ ] `types/database.ts` 更新
- [ ] Transcription型削除
- [ ] 新規型追加

### Phase 5: 動作確認
- [ ] 録音 → 文字起こし → dialogue_turns保存
- [ ] 録音 → 感情分析 → emotion_analysis_results保存
- [ ] daily_summaries自動更新確認

---

## 互換性維持（移行期間）

### オプション: transcriptionsテーブルを一時的に残す

**理由**: 既存データの保護、段階的移行

**方法**:
```sql
-- transcriptionsを削除せずに残す
-- 新規データはdialogue_turnsに保存
-- 古いデータはtranscriptionsから読み取り
```

**推奨**: クリーンに移行（transcriptions削除）

---

**このマッピングドキュメントに基づいて実装を進めればOKです！**
