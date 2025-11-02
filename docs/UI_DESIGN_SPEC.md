# UI設計仕様書

## 画面構成の全体像

```
┌─────────────────────────────────────┐
│ ダッシュボード (/dashboard)          │
│  ├─ 今日の日記入力CTA               │
│  ├─ カレンダーUI                    │
│  └─ 日付クリック → 詳細ページ       │
├─────────────────────────────────────┤
│ 日記詳細ページ (/diary/[date])      │
│  ├─ 感情分析結果                    │
│  ├─ 要約された日記テキスト          │
│  └─ AI対話履歴                      │
├─────────────────────────────────────┤
│ 新規チャット (/diary-chat)          │
│  └─ AI対話インターフェース          │
└─────────────────────────────────────┘
```

---

## 1. ダッシュボード画面 (`/dashboard`)

### 画面レイアウト

```
┌─────────────────────────────────────────────────┐
│ [ヘッダー]                                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 📝 今日の気持ちを記録しましょう        │     │
│  │                                       │     │
│  │ [今日の日記を入力する] ボタン         │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 📅 カレンダー                         │     │
│  │                                       │     │
│  │  日 月 火 水 木 金 土                 │     │
│  │              1  2  3  4              │     │
│  │  5  6  7  8  9 10 11                 │     │
│  │ 12 13 14 15 ●16 17 18   ← ●印: 日記有 │     │
│  │ 19 ●20 21 22 23 24 25                │     │
│  │                                       │     │
│  └───────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### コンポーネント構成

**ページ**: `/app/dashboard/page.tsx`

**使用コンポーネント**:
1. **DiaryCTA** (Call-to-Action)
   - 今日の日記を入力するボタン
   - クリック → `/diary-chat` へ遷移

2. **DiaryCalendar**
   - カレンダーUI表示
   - 日記が存在する日にマーカー表示（●または色付け）
   - 日付クリック → `/diary/[date]` へ遷移

### データ取得

```typescript
// daily_summariesから日記の存在する日付を取得
const { data: summaries } = await supabase
  .from('daily_summaries')
  .select('date, dominant_emotion')
  .eq('user_id', userId)
  .order('date', { ascending: false })
  .limit(90); // 過去3ヶ月分

// カレンダーに表示
const datesWithDiary = summaries.map(s => s.date);
```

### UI要件

**今日の日記入力CTA**:
```tsx
<div className="glass soft-shadow rounded-[24px] p-6 text-center">
  <h2 className="text-xl font-semibold mb-2">今日の気持ちを記録しましょう</h2>
  <p className="text-sm text-muted-foreground mb-4">
    AIがあなたの本音を引き出すお手伝いをします
  </p>
  <Button onClick={() => router.push('/diary-chat')} size="lg">
    📝 今日の日記を入力する
  </Button>
</div>
```

**カレンダーUI**:
- ライブラリ推奨: `react-calendar` または自作
- 日記がある日: 背景色変更 or ドット表示
- 感情によって色分け（オプション）:
  - happy: 🟢 緑
  - sad: 🔵 青
  - angry: 🔴 赤
  - neutral: ⚪️ グレー

---

## 2. 日記詳細ページ (`/diary/[date]`)

### 画面レイアウト

```
┌─────────────────────────────────────────────────┐
│ [ヘッダー] ← 戻るボタン                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 📅 2025年11月1日の振り返り            │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 😊 感情サマリー                       │     │
│  │                                       │     │
│  │ 主な感情: 幸せ                        │     │
│  │                                       │     │
│  │ [円グラフ: 感情分布]                  │     │
│  │ 幸せ: 12回, 悲しみ: 3回, ...          │     │
│  │                                       │     │
│  │ 覚醒度: ████████░░ 4.2               │     │
│  │ 快度:   ██████████ 4.5               │     │
│  │ 優位性: ███████░░░ 3.8               │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 📝 今日の日記                         │     │
│  │                                       │     │
│  │ 今日は友達と喧嘩してしまって...       │     │
│  │ でも、後で仲直りできて良かった。       │     │
│  │                                       │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 💬 AIとの対話                         │     │
│  │                                       │     │
│  │ [対話履歴の表示]                      │     │
│  │                                       │     │
│  │ AI: 今日は少し悲しそうですが...       │     │
│  │ You: 友達と喧嘩しちゃって             │     │
│  │ AI: それは辛かったですね...            │     │
│  │                                       │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 💡 AIからの気づき                     │     │
│  │                                       │     │
│  │ 今日は友人関係で悩んでいましたが、     │     │
│  │ 最終的に仲直りできたことで...          │     │
│  └───────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### コンポーネント構成

**ページ**: `/app/diary/[date]/page.tsx`

**使用コンポーネント**:
1. **EmotionSummaryCard**
   - 感情分布の可視化（円グラフ）
   - VAD値のバー表示
   - 主要な感情表示

2. **DiaryTextCard**
   - その日の日記テキスト
   - transcription_textまたはformatted_text

3. **DialogueHistoryCard**
   - AI対話履歴の表示
   - ユーザー/AI発言を区別して表示

4. **AIInsightsCard**
   - AIが生成した気づきやアドバイス
   - daily_summaries.ai_insights

### データ取得

```typescript
// [date]パラメータから指定日のサマリーを取得
const { data: summary } = await supabase
  .from('daily_summaries')
  .select(`
    *,
    dialogue_turns (
      role,
      content,
      created_at,
      order_index
    )
  `)
  .eq('user_id', userId)
  .eq('date', date)
  .single();
```

### UI要件

**感情サマリーカード**:
- 円グラフライブラリ: `recharts` 推奨
- バーグラフ: カスタムCSS or `recharts`
- 感情の絵文字表示

**日記テキストカード**:
- シンプルなテキスト表示
- 読みやすいフォントサイズ

**AI対話履歴カード**:
- ChatInterfaceコンポーネントを読み取り専用モードで再利用
- またはシンプルなメッセージリスト

---

## 3. 新規チャット画面 (`/diary-chat`)

### 画面レイアウト

```
┌─────────────────────────────────────────────────┐
│ [ヘッダー] ← 戻るボタン                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ 💬 AIとの対話                         │     │
│  │                                       │     │
│  │ 今日の気持ちについて話してみましょう   │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ [チャットメッセージ一覧]              │     │
│  │                                       │     │
│  │ AI: こんにちは！今日はどんな一日でしたか？│
│  │                                       │     │
│  │ You: 友達と喧嘩しちゃって              │     │
│  │      （音声マークまたはテキスト表示）  │     │
│  │                                       │     │
│  │ AI: それは辛かったですね。             │     │
│  │     どんなことがあったんですか？       │     │
│  │                                       │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ [テキスト] [音声]                     │     │
│  │                                       │     │
│  │ メッセージを入力... [送信]            │     │
│  └───────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 機能

**現在実装済み**:
- ✅ テキスト入力
- ✅ メッセージ保存
- ✅ 対話履歴復元
- ✅ デモAI応答

**今後実装**:
- 🔄 OpenAI API統合
- 🔄 音声入力機能
- 🔄 感情データに基づくプロンプト生成

---

## 画面遷移フロー

```
ダッシュボード (/dashboard)
    │
    ├─→ [今日の日記を入力] クリック
    │       ↓
    │   新規チャット (/diary-chat)
    │       ↓
    │   AI対話完了
    │       ↓
    │   ダッシュボードに戻る（自動 or ボタン）
    │
    └─→ [カレンダーの日付] クリック
            ↓
        日記詳細 (/diary/2025-11-01)
            ├─ 感情分析表示
            ├─ 日記テキスト表示
            └─ AI対話履歴表示
```

---

## 詳細仕様

### ダッシュボード (`/dashboard`)

#### 1. 今日の日記入力CTA
**位置**: ページ最上部

**デザイン**:
```tsx
<div className="glass soft-shadow rounded-[24px] p-8 text-center mb-6">
  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary mb-3">
    <MessageCircle className="h-3.5 w-3.5" /> 今日の日記
  </div>
  <h2 className="text-2xl font-semibold mb-2">今日の気持ちを記録しましょう</h2>
  <p className="text-sm text-muted-foreground mb-4">
    AIがあなたの本音を引き出すお手伝いをします
  </p>
  <Button
    onClick={() => router.push('/diary-chat')}
    size="lg"
    className="rounded-full px-8"
  >
    📝 今日の日記を入力する
  </Button>
</div>
```

**表示条件**:
- 常に表示
- すでに今日の日記がある場合: 「今日の日記を続ける」に変更

**アクション**:
- クリック → `/diary-chat` へ遷移

---

#### 2. カレンダーUI

**デザイン要件**:

**日付表示**:
```
┌─────────────────────────────────────┐
│  2025年11月                          │
│  < 前月  |  今月  |  次月 >          │
├─────────────────────────────────────┤
│  日  月  火  水  木  金  土          │
│                  1   2   3   4      │
│   5   6   7   8   9  10  11         │
│  12  13  14  15 [16] 17  18         │
│  19 [20] 21  22  23  24  25         │
│  26  27  28  29  30                 │
└─────────────────────────────────────┘

凡例:
[●] = 今日
[○] = 日記あり
```

**マーカー表示ルール**:
1. **今日**: 太枠 + ハイライト
2. **日記あり**:
   - ドット表示 or 背景色変更
   - 感情によって色分け（オプション）:
     - `happy/excited` → 🟢 緑系
     - `sad/tired` → 🔵 青系
     - `angry/stressed` → 🔴 赤系
     - `calm/relaxed` → 🟡 黄系
     - `neutral` → ⚪️ グレー

**データ取得**:
```typescript
// その月の全サマリーを取得
const { data: monthlySummaries } = await supabase
  .from('daily_summaries')
  .select('date, dominant_emotion, total_recordings')
  .eq('user_id', userId)
  .gte('date', '2025-11-01')
  .lte('date', '2025-11-30');

// 日付 → 感情のマップを作成
const emotionMap = {};
monthlySummaries.forEach(s => {
  emotionMap[s.date] = s.dominant_emotion;
});
```

**インタラクション**:
- 日付クリック → `/diary/[date]` へ遷移
- 日記がない日: クリック無効 or クリック時にメッセージ表示

---

### 日記詳細ページ (`/diary/[date]`)

#### レイアウト構成

**ページ**: `/app/diary/[date]/page.tsx`

**セクション順序**:
1. **ページヘッダー**
   - 日付表示（例: 2025年11月1日の振り返り）
   - 戻るボタン → ダッシュボードへ

2. **感情分析結果**
   - 円グラフ: 感情分布
   - バーグラフ: AVD値
   - 統計情報: 録音回数、総時間

3. **日記テキスト**
   - その日の全文字起こしテキスト
   - または整形済みテキスト

4. **AI対話履歴**
   - その日のdialogue_turnsを表示
   - ユーザー/AI発言を区別

5. **AIからの気づき**
   - daily_summaries.ai_insights
   - 対話完了後にOpenAIで生成された要約

#### コンポーネント

**1. EmotionSummaryCard**
```tsx
<Card className="p-6">
  <h3 className="font-semibold mb-4">😊 感情サマリー</h3>

  {/* 主要な感情 */}
  <div className="text-center mb-4">
    <span className="text-3xl">{getEmotionEmoji(dominant_emotion)}</span>
    <p className="text-lg font-semibold mt-2">{dominant_emotion_label}</p>
  </div>

  {/* 感情分布（円グラフ） */}
  <PieChart data={emotion_distribution} />

  {/* VAD値（バー） */}
  <div className="space-y-2 mt-4">
    <ProgressBar label="覚醒度" value={avg_arousal} max={5} />
    <ProgressBar label="快度" value={avg_valence} max={5} />
    <ProgressBar label="優位性" value={avg_dominance} max={5} />
  </div>

  {/* 統計 */}
  <div className="text-xs text-muted-foreground mt-4">
    録音回数: {total_recordings}回 | 総時間: {total_duration}秒
  </div>
</Card>
```

**2. DiaryTextCard**
```tsx
<Card className="p-6">
  <h3 className="font-semibold mb-4">📝 今日の日記</h3>
  <p className="whitespace-pre-wrap leading-relaxed">
    {transcription_text || formatted_text}
  </p>
</Card>
```

**3. DialogueHistoryCard**
```tsx
<Card className="p-6">
  <h3 className="font-semibold mb-4">💬 AIとの対話</h3>

  <div className="space-y-3">
    {dialogue_turns.map((turn, i) => (
      <div key={i} className={turn.role === 'user' ? 'text-right' : 'text-left'}>
        <div className={`inline-block rounded-2xl px-4 py-2 ${
          turn.role === 'user' ? 'bg-primary text-white' : 'bg-muted'
        }`}>
          <p className="text-sm">{turn.content}</p>
        </div>
      </div>
    ))}
  </div>
</Card>
```

**4. AIInsightsCard**
```tsx
<Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
  <h3 className="font-semibold mb-4">💡 AIからの気づき</h3>
  <p className="text-sm leading-relaxed">
    {ai_insights || '対話完了後に生成されます'}
  </p>
</Card>
```

#### データ取得

```typescript
// URLパラメータから日付を取得
const { date } = params;

// その日のサマリーを取得
const { data: summary } = await supabase
  .from('daily_summaries')
  .select('*')
  .eq('user_id', userId)
  .eq('date', date)
  .single();

// その日の対話履歴を取得
const { data: turns } = await supabase
  .from('dialogue_turns')
  .select('*')
  .eq('user_id', userId)
  .eq('date', date)
  .order('order_index', { ascending: true });
```

---

## 4. 新規チャット画面 (`/diary-chat`)

### 既に実装済み

**実装内容**:
- ✅ ChatInterfaceコンポーネント
- ✅ テキスト入力
- ✅ メッセージ保存
- ✅ 対話履歴復元

**表示条件**:
- 今日の日記入力中: 新規対話
- 過去の日記: 読み取り専用（詳細ページで表示）

---

## ナビゲーション構造

### ヘッダーメニュー

```
┌─────────────────────────────────────┐
│ [ロゴ] 音声日記                      │
│                                     │
│  [ダッシュボード] [AIチャット] [ログアウト] │
└─────────────────────────────────────┘
```

**リンク**:
- **ダッシュボード** → `/dashboard`
- **AIチャット** → `/diary-chat`
- **音声日記** → `/voice-diary`（録音専用ページ、オプション）

---

## 実装優先度

### Phase 1（必須）
1. ✅ `/diary-chat` - 新規チャット画面（実装済み）
2. 🔲 `/dashboard` - ダッシュボード
3. 🔲 `/diary/[date]` - 日記詳細ページ

### Phase 2（機能追加）
4. 🔲 OpenAI API統合
5. 🔲 音声入力機能
6. 🔲 AIインサイト生成

### Phase 3（UI改善）
7. 🔲 感情グラフの可視化
8. 🔲 カレンダーの感情色分け
9. 🔲 アニメーション追加

---

## 技術スタック

### ライブラリ推奨

**カレンダー**:
- `react-calendar` - シンプル、カスタマイズ可能
- または `@fullcalendar/react` - 高機能

**グラフ**:
- `recharts` - React向け、レスポンシブ
- または `chart.js` + `react-chartjs-2`

**日付処理**:
- `date-fns` - 軽量
- または標準のDate API

---

## データフロー（全体像）

```
1. ユーザーがダッシュボードにアクセス
   ↓
2. daily_summariesから日記がある日付を取得
   ↓
3. カレンダーに表示
   ↓
4. 「今日の日記を入力」クリック
   ↓
5. /diary-chat で対話
   ↓
6. dialogue_turnsに保存
   ↓
7. 対話完了 → AIインサイト生成
   ↓
8. daily_summariesを更新
   ↓
9. ダッシュボードに戻る → カレンダーに今日の日記が表示される
   ↓
10. 今日の日付クリック
   ↓
11. /diary/2025-11-01 で詳細表示
    ├─ 感情グラフ
    ├─ 日記テキスト
    └─ AI対話履歴
```

---

## 次のアクション

### 実装順序

1. **ダッシュボードページ作成**
   - [ ] `/app/dashboard/page.tsx`
   - [ ] `features/dashboard/components/DiaryCTA`
   - [ ] `features/dashboard/components/DiaryCalendar`

2. **日記詳細ページ作成**
   - [ ] `/app/diary/[date]/page.tsx`
   - [ ] `features/diary-detail/components/EmotionSummaryCard`
   - [ ] `features/diary-detail/components/DiaryTextCard`
   - [ ] `features/diary-detail/components/DialogueHistoryCard`
   - [ ] `features/diary-detail/components/AIInsightsCard`

3. **グラフライブラリ導入**
   - [ ] `npm install recharts`
   - [ ] 円グラフコンポーネント作成
   - [ ] バーグラフコンポーネント作成

4. **カレンダーライブラリ導入**
   - [ ] `npm install react-calendar`
   - [ ] カスタムスタイリング
   - [ ] 日記マーカー実装

---

**最終更新**: 2025年11月1日
**バージョン**: 1.0
**ステータス**: 設計確定
