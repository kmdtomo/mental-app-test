# 日記生成・AIアドバイスのプロンプト最適化

## 📊 改善の概要

日記要約とAIインサイト生成のプロンプトを最適化し、VAD値の生データを削除して感情ラベルベースのシステムに変更しました。

---

## 🎯 改善のポイント

### **1. 日記要約プロンプト → 変更なし**

**現状維持（すでに最適）:**
```typescript
【会話内容】
(対話履歴)

【要件】
- 出来事の記述と、その時の感情・体調の変化を含める
- 会話の中で明らかになった気持ちの変化も反映する
- 一人称（「私」は省略可）で自然な文章に
- 接続詞を使って読みやすく
- 2-3段落、150-200文字程度
```

**理由:**
- 会話内容のみで十分
- 感情分析データは不要（会話から読み取れる）
- シンプルで明確

---

### **2. AIインサイトプロンプト → 大幅改善**

#### **改善前（VAD値ベース）:**
```typescript
【音声分析結果（最重要）】
エネルギーレベル: 3.85 / 5.0（低い=疲れ・落ち着き、高い=興奮・緊張）
気分: 3.72 / 5.0（低い=ネガティブ、高い=ポジティブ）

【会話内容（参考）】
(会話履歴)

【要件】
- 音声の特徴から読み取れる感情状態を中心に記述
- 「声のトーンから」「声には〜が表れています」など、音声分析を明示
- 専門用語は使わない
- 言葉と声のギャップがあれば優しく指摘  ← テキスト判定が必要（矛盾）
- 2文、80-120文字程度

【音声分析の解釈基準】
- エネルギー低 × 気分低 = 疲労・落ち込み
- エネルギー高 × 気分低 = ストレス・緊張
...
```

**問題点:**
1. ❌ VAD値の生データ（3.85）→ AIは「高い」「低い」を判断できない
2. ❌ 「言葉と声のギャップ」→ テキストベースの判定が必要（矛盾）
3. ❌ 解釈基準が曖昧→ 「エネルギー低」の基準が不明確

---

#### **改善後（感情ラベルベース）:**
```typescript
【音声分析結果】
全体的な感情: 悲しみ（最も多く検出された感情）
感情の変化: 穏やか・リラックス → 悲しみ → 中立

【会話内容】
(会話履歴)

【要件】
- 会話の内容と感情の変化を踏まえて、今日の心の状態を伝える
- 具体的な場面を引用しながら「〜という話をされていましたが、その時の声には〜が表れていました」のように記述
- 2-3文、100-150文字程度
- 共感的で優しい口調
- 専門用語は使わない
```

**改善点:**
1. ✅ **VAD値を削除** → 感情ラベルのみ
2. ✅ **感情の変化を明示** → 具体的な流れを提示
3. ✅ **「言葉と声のギャップ」を削除** → テキスト判定不要
4. ✅ **シンプルに** → AIが判断しやすい
5. ✅ **具体的な引用を促す** → より説得力のある出力

---

### **3. データ取得の変更**

#### **改善前:**
```typescript
// emotion_analysis_resultsから取得
const { data: emotions } = await supabase
  .from('emotion_analysis_results')
  .select('avg_arousal, avg_valence, avg_dominance, ...')
  .in('recording_id', recordingIds);

// VAD値を計算
const avgArousal = sumArousal / emotionResults.length;
const avgValence = sumValence / emotionResults.length;
```

#### **改善後:**
```typescript
// transcription_segmentsから直接取得
const { data: segments } = await supabase
  .from('transcription_segments')
  .select('emotion_label, segment_index, recording_id')
  .in('recording_id', recordingIds)
  .order('recording_id', { ascending: true })
  .order('segment_index', { ascending: true });

// 感情ラベルをカウント
for (const segment of segments) {
  const label = segment.emotion_label;
  if (label) {
    emotionCounts[label] = (emotionCounts[label] || 0) + 1;
    allEmotionLabels.push(label);
  }
}

// 主要な感情を決定
dominantEmotion = Object.entries(emotionCounts)
  .reduce((a, b) => b[1] > a[1] ? b : a)[0];

// 感情の変化パターンを検出
const emotionFlow = [];
let prevEmotion = '';
for (const emotion of allEmotionLabels) {
  if (emotion !== prevEmotion) {
    emotionFlow.push(emotion);
    prevEmotion = emotion;
  }
}
```

---

### **4. データベース保存の変更**

#### **改善前:**
```typescript
const summaryData = {
  formatted_text: diarySummary,
  avg_arousal: avgArousal,        // VAD値
  avg_valence: avgValence,        // VAD値
  avg_dominance: avgDominance,    // VAD値
  dominant_emotion: null,
  emotion_distribution: null,
  ...
};
```

#### **改善後:**
```typescript
const summaryData = {
  formatted_text: diarySummary,
  avg_arousal: null,                      // 使用しない
  avg_valence: null,                      // 使用しない
  avg_dominance: null,                    // 使用しない
  dominant_emotion: dominantEmotion,      // 感情ラベル
  emotion_distribution: emotionCounts,    // 感情の分布
  ...
};
```

---

## 📝 実際の例

### **サッカーの試合の例**

**入力（会話履歴）:**
```
ユーザー: 今日はサッカーの試合がありました。相手はカテゴリーが一つ上の、格上の相手でしたが、
試合内容的にはほとんどやれていったと思います。しかし、最後のところで力の差が出て、
2対3で一歩及びませんでした。いろいろ課題がある中で、あとリーグ戦がまで半年くらい
あるので、戦術的に仕上げていきたいなと思いました。

AI: 格上の相手にほとんど互角に戦えたのは素晴らしいですね。
でも、「2対3で一歩及びませんでした」と話された時、
声のトーンがぐっと沈んでいたのが印象的でした。
その瞬間、どんな気持ちだったのか聞かせてもらえますか？
```

**感情分析結果:**
```
全体的な感情: 悲しみ
感情の変化: 穏やか・リラックス → 悲しみ → 中立
```

**期待されるAIインサイト:**
```
試合の結果を話された時、特に「2対3で一歩及びませんでした」という部分で
声のトーンが大きく沈んでいたのが印象的でした。前向きに次を見据えようと
されていますが、悔しさや無念さも感じられます。
```

---

## 🔧 実装詳細

### **変更ファイル:**
- `app/api/generate-summary/route.ts`

### **主な変更:**
1. **データ取得** (L102-147)
   - `emotion_analysis_results` → `transcription_segments`
   - VAD値の計算削除
   - 感情ラベルのカウントと変化検出を追加

2. **AIインサイトプロンプト** (L154-189)
   - VAD値を削除
   - 感情ラベルと変化パターンを追加
   - 「言葉と声のギャップ」指示を削除
   - より具体的な引用を促す指示に変更

3. **データベース保存** (L205-216)
   - `avg_arousal`, `avg_valence`, `avg_dominance` → `null`
   - `dominant_emotion` → 感情ラベル
   - `emotion_distribution` → 感情カウント

4. **レスポンス** (L247-261)
   - VAD値を削除
   - `emotionFlow`（感情の変化）を追加

---

## ✅ まとめ

**改善の原則:**
1. **VAD値の生データは使わない** → AIは数値を理解できない
2. **感情ラベルのみを使用** → 明確で理解しやすい
3. **感情の変化を明示** → より具体的なインサイト
4. **テキストベースの判定を削除** → 音声分析のみを信頼

これにより、より自然で説得力のあるAIインサイトが生成されるようになりました！
