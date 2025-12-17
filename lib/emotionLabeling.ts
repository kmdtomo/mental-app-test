/**
 * 統一された感情ラベリングシステム
 *
 * VAD値の実測範囲: Valence, Arousal, Dominance ∈ [3.2, 4.2]
 * 実測中心値: 約3.7
 *
 * 9種類のシンプルで実用的な感情ラベルを提供（怒りを追加）
 *
 * 2025-12-17更新: 実データの分布（3.4〜4.1に集中）に合わせて閾値を調整
 */

// 実測データに基づいた閾値（実データ分布: 3.2〜4.2、中央値約3.7）
export const VAD_THRESHOLDS = {
  // 基準値（中央）- 実データの中央値に合わせて調整
  CENTER: 3.7,

  // 中立範囲を狭く設定（中央値から±0.1）
  NEUTRAL_MIN: 3.65,
  NEUTRAL_MAX: 3.75,

  // 低い判定（下位30%程度）
  LOW: 3.55,
  VERY_LOW: 3.45,

  // 高い判定（上位30%程度）
  HIGH: 3.85,
  VERY_HIGH: 4.0,
} as const;

// 感情ラベルの型定義
export type EmotionLabel =
  | '喜び・楽しい'      // ポジティブ高覚醒
  | '穏やか・リラックス'  // ポジティブ低覚醒
  | 'ストレス・緊張'    // ネガティブ高覚醒（制御感あり）
  | '不安・心配'        // ネガティブ高覚醒（圧倒されている）
  | '怒り・イライラ'    // ネガティブ高覚醒（高Dominance、非常に低いValence）
  | '悲しみ'           // ネガティブ低覚醒
  | '疲労・無気力'      // ネガティブ極低覚醒
  | '中立'            // 中立状態
  | '落ち着き';        // やや快・やや低覚醒

export type EmotionCategory = 'positive' | 'negative' | 'neutral';

export interface EmotionResult {
  label: EmotionLabel;
  category: EmotionCategory;
  emoji: string;
  color: string;
  description: string;
}

/**
 * VAD値から感情ラベルを判定する統一関数
 *
 * @param arousal - 覚醒度 [3.2～4.2]（中心: 3.7）
 * @param valence - 快度 [3.2～4.2]（中心: 3.7）
 * @param dominance - 優位度 [3.2～4.2]（中心: 3.7）※補助的に使用
 * @returns 感情ラベルと関連情報
 */
export function getEmotionFromVAD(
  arousal: number,
  valence: number,
  dominance: number
): EmotionResult {
  const T = VAD_THRESHOLDS;

  // 1. 中立判定（最優先、範囲を狭く）
  if (
    valence >= T.NEUTRAL_MIN && valence <= T.NEUTRAL_MAX &&
    arousal >= T.NEUTRAL_MIN && arousal <= T.NEUTRAL_MAX
  ) {
    return {
      label: '中立',
      category: 'neutral',
      emoji: '😐',
      color: 'text-transparent',
      description: '特に感情的な変化が見られない落ち着いた状態',
    };
  }

  // 2. 高覚醒（A >= 3.85）
  if (arousal >= T.HIGH) {
    // 2-1. 高覚醒 × 高快度 = 喜び・楽しい
    if (valence >= T.HIGH) {
      return {
        label: '喜び・楽しい',
        category: 'positive',
        emoji: '😊',
        color: 'text-amber-500',
        description: '明るく活発な気分、ポジティブなエネルギー',
      };
    }

    // 2-2. 高覚醒 × 低快度 = 怒り or ストレス or 不安
    if (valence < T.LOW) {
      // 非常に低いValence + 高Dominance = 怒り・イライラ
      if (valence < T.VERY_LOW && dominance >= T.HIGH) {
        return {
          label: '怒り・イライラ',
          category: 'negative',
          emoji: '😠',
          color: 'text-red-500',
          description: '怒りやイライラを感じている状態、強い不満',
        };
      }
      // Dominanceで補助判定（ストレス vs 不安）
      if (dominance >= T.HIGH) {
        return {
          label: 'ストレス・緊張',
          category: 'negative',
          emoji: '😰',
          color: 'text-orange-500',
          description: '緊張感やプレッシャーを感じている状態、まだコントロール感がある',
        };
      } else {
        return {
          label: '不安・心配',
          category: 'negative',
          emoji: '😟',
          color: 'text-violet-500',
          description: '不安や心配を感じ、やや圧倒されている状態',
        };
      }
    }
  }

  // 3. 低覚醒（A < 3.55）
  if (arousal < T.LOW) {
    // 3-1. 低覚醒 × 高快度 = 穏やか・リラックス
    if (valence >= T.HIGH) {
      return {
        label: '穏やか・リラックス',
        category: 'positive',
        emoji: '😌',
        color: 'text-emerald-500',
        description: '穏やかでリラックスした状態、心地よい落ち着き',
      };
    }

    // 3-2. 低覚醒 × 低快度
    if (valence < T.LOW) {
      // 極端に低覚醒 = 疲労・無気力
      if (arousal < T.VERY_LOW) {
        return {
          label: '疲労・無気力',
          category: 'negative',
          emoji: '😴',
          color: 'text-gray-500',
          description: 'エネルギーが低下し、疲れや無気力を感じている状態',
        };
      } else {
        return {
          label: '悲しみ',
          category: 'negative',
          emoji: '😢',
          color: 'text-blue-500',
          description: '悲しみや落ち込みを感じている状態',
        };
      }
    }

    // 3-3. 低覚醒 × 中程度の快度 = 落ち着き
    return {
      label: '落ち着き',
      category: 'positive',
      emoji: '🙂',
      color: 'text-teal-500',
      description: '静かで落ち着いた状態、安定している',
    };
  }

  // 4. 中程度の覚醒（3.55 <= A < 3.85）
  if (valence >= T.HIGH) {
    return {
      label: '落ち着き',
      category: 'positive',
      emoji: '🙂',
      color: 'text-teal-500',
      description: '穏やかで満足している状態',
    };
  } else if (valence < T.LOW) {
    return {
      label: '悲しみ',
      category: 'negative',
      emoji: '😢',
      color: 'text-blue-500',
      description: 'やや沈んだ気分、落ち込み傾向',
    };
  }

  // 5. デフォルト（全てが中程度）= 中立
  return {
    label: '中立',
    category: 'neutral',
    emoji: '😐',
    color: 'text-transparent',
    description: '特に顕著な感情が見られない状態',
  };
}

/**
 * 感情ラベルから絵文字を取得
 */
export function getEmotionEmoji(label: string): string {
  const emojiMap: Record<string, string> = {
    '喜び・楽しい': '😊',
    '穏やか・リラックス': '😌',
    '落ち着き': '🙂',
    '中立': '😐',
    'ストレス・緊張': '😰',
    '不安・心配': '😟',
    '悲しみ': '😢',
    '疲労・無気力': '😴',
    '怒り・イライラ': '😠',
  };

  return emojiMap[label] || '😐';
}

/**
 * 統一カラー定義（HEXカラー）
 * グラフとUIの両方で使用
 */
export const EMOTION_COLORS: Record<string, string> = {
  '喜び・楽しい': '#F59E0B',      // amber-500 (黄/オレンジ)
  '穏やか・リラックス': '#10B981', // emerald-500 (緑)
  '落ち着き': '#14B8A6',          // teal-500 (ティール)
  '中立': 'transparent',          // 無色（感情なし）
  'ストレス・緊張': '#F97316',    // orange-500 (オレンジ)
  '不安・心配': '#A78BFA',        // violet-400 (紫)
  '悲しみ': '#3B82F6',            // blue-500 (青)
  '疲労・無気力': '#6B7280',      // gray-500
  '怒り・イライラ': '#EF4444',    // red-500 (赤)
};

/**
 * グラフ用Y軸位置（ポジティブが上、ネガティブが下）
 */
export const EMOTION_Y_POSITION: Record<string, number> = {
  '喜び・楽しい': 0.9,
  '穏やか・リラックス': 0.7,
  '落ち着き': 0.6,
  '中立': 0.5,
  'ストレス・緊張': 0.3,
  '不安・心配': 0.2,
  '悲しみ': 0.1,
  '疲労・無気力': 0.05,
  '怒り・イライラ': 0.0,
};

/**
 * 感情ラベルからTailwind CSSカラークラスを取得
 */
export function getEmotionColor(label: string): string {
  const colorMap: Record<string, string> = {
    '喜び・楽しい': 'text-amber-500',
    '穏やか・リラックス': 'text-emerald-500',
    '落ち着き': 'text-teal-500',
    '中立': 'text-transparent',       // 無色
    'ストレス・緊張': 'text-orange-500',
    '不安・心配': 'text-violet-400',
    '悲しみ': 'text-blue-500',
    '疲労・無気力': 'text-gray-500',
    '怒り・イライラ': 'text-red-500',
  };

  return colorMap[label] || 'text-transparent';
}

/**
 * 感情ラベルからHEXカラーを取得（グラフ用）
 * 中立の場合はグレーを返す（透明だとグラフで見えないため）
 */
export function getEmotionHexColor(label: string): string {
  const color = EMOTION_COLORS[label];
  // 中立（transparent）の場合はグレーを返す
  if (color === 'transparent') return '#D1D5DB'; // gray-300
  return color || '#D1D5DB';
}

/**
 * 感情ラベルからHEXカラーを取得（UI用）
 * 中立の場合はtransparentを返す（テキストの下線などに使用）
 */
export function getEmotionHexColorForUI(label: string): string {
  const color = EMOTION_COLORS[label];
  return color || 'transparent';
}

/**
 * グラデーション用の中立色（グラフの線用）
 */
export const NEUTRAL_GRADIENT_COLOR = '#D1D5DB'; // gray-300

/**
 * 感情カテゴリを取得
 */
export function getEmotionCategory(label: string): EmotionCategory {
  const positiveLabels = ['喜び・楽しい', '穏やか・リラックス', '落ち着き'];
  const negativeLabels = ['ストレス・緊張', '不安・心配', '悲しみ', '疲労・無気力', '怒り・イライラ'];

  if (positiveLabels.includes(label)) return 'positive';
  if (negativeLabels.includes(label)) return 'negative';
  return 'neutral';
}

/**
 * AIプロンプト用の感情説明を生成
 */
export function getEmotionDescriptionForAI(): string {
  return `
# 感情ラベルの定義（VAD理論ベース）

以下の9種類の感情ラベルを使用します：

## ポジティブ感情
1. **喜び・楽しい** (😊): 高覚醒×高快度 - 明るく活発な気分、ポジティブなエネルギー
2. **穏やか・リラックス** (😌): 低覚醒×高快度 - 穏やかでリラックスした状態、心地よい落ち着き
3. **落ち着き** (🙂): 中覚醒×やや高快度 - 静かで落ち着いた状態、安定している

## ネガティブ感情
4. **ストレス・緊張** (😰): 高覚醒×低快度×高優位度 - 緊張感やプレッシャー、まだコントロール感がある
5. **不安・心配** (😟): 高覚醒×低快度×低優位度 - 不安や心配、やや圧倒されている
6. **怒り・イライラ** (😠): 高覚醒×非常に低い快度×高優位度 - 怒りやイライラ、強い不満
7. **悲しみ** (😢): 低覚醒×低快度 - 悲しみや落ち込み
8. **疲労・無気力** (😴): 極低覚醒×低快度 - エネルギー低下、疲れや無気力

## 中立
9. **中立** (😐): 全て中央付近 - 特に感情的な変化が見られない状態

**重要**: これらのラベルはVAD値（覚醒度・快度・優位度）に基づいて自動判定されています。
ユーザーの発言内容と感情ラベルを照らし合わせて、より深い理解を促す質問をしてください。
`.trim();
}
