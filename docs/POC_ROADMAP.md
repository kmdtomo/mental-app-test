# メンタルアップテスト POC ロードマップ

## 概要
音声日記と感情分析を組み合わせた、AI対話型メンタルヘルスアプリケーションのPOC（Proof of Concept）開発計画

## 現在の実装状況

### ✅ 完了済み
- 音声録音機能（44.1kHz WAV形式）
- Whisper APIによる文字起こし
- VAD（Voice Activity Detection）による自動音声分割
- セグメントごとの感情分析（Arousal/Valence/Dominance）
- VAD値から感情へのマッピング（9種類の感情）
- UI表示（総評 + セグメント詳細）

## POC開発タスク

### Phase 1: データベース設計と実装

#### 1.1 感情分析結果テーブルの作成
**目的**: 音声録音に紐付けた感情分析の詳細結果を保存

**テーブル名**: `emotion_analysis_results`

**カラム構成**:
```sql
CREATE TABLE emotion_analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID NOT NULL REFERENCES voice_recordings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- 総評データ
  total_segments INT NOT NULL,
  avg_arousal DECIMAL(10, 6) NOT NULL,
  avg_valence DECIMAL(10, 6) NOT NULL,
  avg_dominance DECIMAL(10, 6) NOT NULL,
  dominant_emotion VARCHAR(50),

  -- セグメント詳細（JSON配列）
  segments JSONB NOT NULL,

  -- メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_emotion_analysis_recording ON emotion_analysis_results(recording_id);
CREATE INDEX idx_emotion_analysis_user ON emotion_analysis_results(user_id);
CREATE INDEX idx_emotion_analysis_created ON emotion_analysis_results(created_at DESC);
```

**segments JSONBの構造例**:
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
  ...
]
```

#### 1.2 日次サマリーテーブルの作成
**目的**: その日の日記と感情の総合データを保存

**テーブル名**: `daily_summaries`

**カラム構成**:
```sql
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,

  -- 文字起こしテキスト（その日の全録音）
  transcription_text TEXT,
  formatted_text TEXT,

  -- 感情データ（その日の平均値）
  avg_arousal DECIMAL(10, 6),
  avg_valence DECIMAL(10, 6),
  avg_dominance DECIMAL(10, 6),
  dominant_emotion VARCHAR(50),

  -- 感情分布
  emotion_distribution JSONB,

  -- 録音メタデータ
  total_recordings INT DEFAULT 0,
  total_duration_seconds INT DEFAULT 0,

  -- AI対話履歴
  ai_conversation JSONB,

  -- メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, date)
);

-- インデックス
CREATE INDEX idx_daily_summaries_user_date ON daily_summaries(user_id, date DESC);
```

#### 1.3 既存テーブルとの紐付け
**既存テーブル**: `voice_recordings`, `transcriptions`

**リレーション**:
```
voice_recordings (1) -> (1) emotion_analysis_results
voice_recordings (n) -> (1) daily_summaries
transcriptions (n) -> (1) daily_summaries
```

**実装タスク**:
- [ ] Supabaseマイグレーションファイル作成
- [ ] テーブル作成SQLの実行
- [ ] RLS（Row Level Security）ポリシーの設定
- [ ] TypeScript型定義の生成

---

### Phase 2: AI対話システムの実装

#### 2.1 OpenAI APIとの統合

**使用API**: OpenAI Chat Completions API
**モデル**: GPT-4o または GPT-4o-mini

**実装場所**: `/app/api/ai-chat/route.ts`

**機能**:
1. 文字起こしテキストと感情分析データを受け取る
2. OpenAI APIにコンテキストとして送信
3. ユーザーとの対話を管理
4. 感情に応じた適切な応答を生成

#### 2.2 プロンプト設計

**システムプロンプト**（基本方針）:
```
あなたはメンタルヘルスをサポートするAIカウンセラーです。
ユーザーの音声日記の内容と感情分析データをもとに、
本音を引き出すために深掘りする質問をしてください。

【重要な原則】
1. 共感的で優しい口調を使う
2. 批判や評価はしない
3. オープンエンドな質問で本音を引き出す
4. 感情を言語化するサポートをする
5. ユーザーのペースを尊重する
```

**動的プロンプト生成ロジック**:

```typescript
// 文章から明確な感情が読み取れる場合
if (transcriptionIndicatesEmotion) {
  prompt = `
    ユーザーは「${extractedEmotion}」について話しています。
    文章: "${transcriptionText}"

    このことについて、さらに詳しく聞いてください。
    例: 「それは辛かったですね。何があったんですか？」
  `;
}

// 文章から感情が読み取れないが、音声分析で感情が検出された場合
if (!transcriptionIndicatesEmotion && emotionAnalysisShowsEmotion) {
  prompt = `
    ユーザーの文章は中立的ですが、音声分析では「${detectedEmotion}」の傾向が見られます。
    文章: "${transcriptionText}"
    感情データ: Arousal=${arousal}, Valence=${valence}

    声のトーンから察して、優しく感情を確認してください。
    例: 「今日は少し${emotionLabel}そうに聞こえますが、何かありましたか？」
  `;
}
```

**感情ごとの対話戦略**:

| 検出感情 | 対話アプローチ | 質問例 |
|---------|--------------|--------|
| **sad** (悲しみ) | 共感 → 傾聴 → 深掘り | 「辛いことがあったんですね。よかったら話してもらえますか？」 |
| **angry** (怒り) | 受容 → 感情の言語化 | 「イライラすることがあったんですね。どんなことがあったんですか？」 |
| **stressed** (ストレス) | 理解 → 原因の特定 | 「大変そうですね。何が一番大変でしたか？」 |
| **tired** (疲労) | 労い → 休息の確認 | 「お疲れのようですね。最近ゆっくり休めていますか？」 |
| **happy** (幸せ) | 肯定 → 喜びの共有 | 「嬉しいことがあったんですね！どんなことがあったんですか？」 |
| **excited** (興奮) | 関心 → 詳細の引き出し | 「ワクワクすることがあったんですね。詳しく教えてください！」 |
| **calm** (穏やか) | 確認 → 現状の把握 | 「落ち着いて過ごせているようですね。今の調子はどうですか？」 |
| **neutral** (中立) | 一般的な確認 | 「今日はどんな一日でしたか？」 |

#### 2.3 対話フロー

```
1. ユーザーが音声日記を録音
   ↓
2. 文字起こし + 感情分析を実行
   ↓
3. AIが初回メッセージを生成
   - 文章内容を要約
   - 感情に基づいた質問を投げかける
   ↓
4. ユーザーが返信（テキストまたは音声）
   ↓
5. AIが深掘り質問
   - より具体的な状況を聞く
   - 感情の背景を探る
   ↓
6. 対話を3〜5ターン繰り返す
   ↓
7. 対話履歴をdaily_summariesに保存
```

**実装タスク**:
- [ ] `/app/api/ai-chat/route.ts` 作成
- [ ] プロンプトテンプレート実装
- [ ] 感情ベースの動的プロンプト生成
- [ ] OpenAI APIコール実装
- [ ] 対話履歴管理
- [ ] エラーハンドリング

#### 2.4 フロントエンド実装

**新規コンポーネント**:
- `AIChatInterface.tsx` - AI対話UI
- `DailySummary.tsx` - その日のサマリー表示
- `EmotionTimeline.tsx` - 感情の時系列表示

**実装タスク**:
- [ ] AI対話UI実装
- [ ] 音声/テキスト入力の切り替え
- [ ] リアルタイムチャット表示
- [ ] ローディング状態の表示

---

### Phase 3: 日次サマリー機能

#### 3.1 サマリー生成ロジック

**トリガー**:
- その日の最後の録音 + AI対話完了時
- または、ユーザーが「今日のまとめを見る」ボタンをクリック

**生成内容**:
```typescript
interface DailySummary {
  date: string;

  // テキストサマリー
  transcriptionSummary: string; // その日の全文字起こし（整形済み）

  // 感情サマリー
  emotionalOverview: {
    dominantEmotion: string; // その日の主な感情
    avgArousal: number;
    avgValence: number;
    avgDominance: number;
    emotionDistribution: {
      happy: number;
      sad: number;
      angry: number;
      // ...
    };
  };

  // AI対話サマリー
  aiInsights: string; // AIが生成した気づきやアドバイス

  // メタデータ
  totalRecordings: number;
  totalDuration: number;
}
```

#### 3.2 サマリー表示UI

**デザインイメージ**:
```
┌─────────────────────────────────────┐
│ 2025年11月1日の振り返り              │
├─────────────────────────────────────┤
│ 📝 日記サマリー                      │
│ 今日は...（文字起こしの要約）         │
├─────────────────────────────────────┤
│ 😊 感情サマリー                      │
│ 主な感情: 幸せ                       │
│ [円グラフ: 感情の分布]                │
│                                     │
│ 覚醒度: ████████░░ 4.2/5           │
│ 快度:   ██████████ 4.5/5           │
│ 優位性: ███████░░░ 3.8/5           │
├─────────────────────────────────────┤
│ 💬 AIとの対話                        │
│ [対話履歴の表示]                     │
├─────────────────────────────────────┤
│ 💡 今日の気づき                      │
│ AIが生成したインサイト                │
└─────────────────────────────────────┘
```

**実装タスク**:
- [ ] サマリー生成API実装
- [ ] サマリー表示ページ作成
- [ ] 感情分布の可視化（Chart.js等）
- [ ] 過去のサマリー一覧表示

---

## 技術スタック

### バックエンド
- **データベース**: Supabase (PostgreSQL)
- **API**: Next.js App Router (API Routes)
- **感情分析**: Python (Wav2Vec2 + VAD)
- **音声認識**: OpenAI Whisper API
- **AI対話**: OpenAI Chat Completions API

### フロントエンド
- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **UI**: React + Tailwind CSS
- **状態管理**: React Hooks
- **音声録音**: extendable-media-recorder

---

## データフロー図

```
┌─────────────┐
│ ユーザー録音 │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ 音声保存         │
│ (Supabase)      │
└──────┬──────────┘
       │
       ├───────────┐
       │           │
       ▼           ▼
┌──────────┐  ┌──────────────┐
│ Whisper  │  │ 感情分析      │
│ 文字起こし│  │ (VAD分割+VAD) │
└────┬─────┘  └──────┬───────┘
     │                │
     │                ▼
     │         ┌─────────────────┐
     │         │ emotion_analysis │
     │         │ _results 保存    │
     │         └─────────────────┘
     │
     ▼
┌──────────────────┐
│ AI対話開始        │
│ (OpenAI API)     │
│ - 文章分析        │
│ - 感情データ活用  │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ ユーザーとの対話  │
│ (3〜5ターン)      │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ daily_summaries  │
│ 保存              │
│ - 日記テキスト    │
│ - 感情総評        │
│ - AI対話履歴      │
└────┬─────────────┘
     │
     ▼
┌──────────────────┐
│ サマリー表示      │
│ - 感情グラフ      │
│ - AIインサイト    │
└──────────────────┘
```

---

## 開発スケジュール（想定）

### Week 1: データベース実装
- [ ] テーブル設計
- [ ] マイグレーション作成
- [ ] RLSポリシー設定
- [ ] 型定義生成

### Week 2: AI対話システム（基礎）
- [ ] OpenAI API統合
- [ ] プロンプト設計
- [ ] 基本的な対話フロー実装

### Week 3: AI対話システム（応用）
- [ ] 感情ベースの動的プロンプト
- [ ] 対話履歴管理
- [ ] フロントエンドUI実装

### Week 4: 日次サマリー機能
- [ ] サマリー生成ロジック
- [ ] 可視化実装
- [ ] 統合テスト

---

## 成功指標（KPI）

### 技術的指標
- [ ] 感情分析の精度: 複数の異なる感情を検出できる
- [ ] AI応答時間: 3秒以内
- [ ] データベース書き込み成功率: 99%以上

### ユーザー体験指標
- [ ] AI対話の自然さ: 違和感のない応答
- [ ] 本音の引き出し度: 深掘り質問の有効性
- [ ] サマリーの有用性: ユーザーの自己理解に貢献

---

## リスクと対策

| リスク | 影響 | 対策 |
|-------|------|------|
| OpenAI APIコスト | 高 | GPT-4o-miniの使用、トークン制限 |
| 感情分析の精度 | 中 | 閾値の継続的調整、ユーザーフィードバック |
| データプライバシー | 高 | RLS徹底、データ暗号化 |
| AI応答の遅延 | 中 | ストリーミング応答、ローディング表示 |

---

## 次のステップ

1. **Phase 1から順次実装**
2. **小規模ユーザーテスト**（3〜5名）
3. **フィードバック収集**
4. **改善とイテレーション**
5. **本番リリース判断**

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [VAD理論](https://en.wikipedia.org/wiki/Emotion_classification#Dimensional_models)
- [Wav2Vec2 Model](https://huggingface.co/docs/transformers/model_doc/wav2vec2)

---

**最終更新**: 2025年11月1日
**バージョン**: 1.0
**ステータス**: POC計画中
