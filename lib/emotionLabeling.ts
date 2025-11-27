/**
 * 統一された感情ラベリングシステム
 *
 * VAD値の実測範囲: Valence, Arousal, Dominance ∈ [3.4, 4.6]
 * 中心値: 4.0
 *
 * 8種類のシンプルで実用的な感情ラベルを提供
 */

// 実測データに基づいた閾値
export const VAD_THRESHOLDS = {
  // 基準値（中央）
  CENTER: 4.0,

  // 中立範囲を狭く設定（中央値から±0.1）
  NEUTRAL_MIN: 3.9,
  NEUTRAL_MAX: 4.1,

  // 低い判定（下位30%程度）
  LOW: 3.8,
  VERY_LOW: 3.65,

  // 高い判定（上位30%程度）
  HIGH: 4.2,
  VERY_HIGH: 4.35,
} as const;

// 感情ラベルの型定義
export type EmotionLabel =
  | '喜び・楽しい'      // ポジティブ高覚醒
  | '穏やか・リラックス'  // ポジティブ低覚醒
  | 'ストレス・緊張'    // ネガティブ高覚醒（制御感あり）
  | '不安・心配'        // ネガティブ高覚醒（圧倒されている）
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
 * @param arousal - 覚醒度 [3.4～4.6]（中心: 4.0）
 * @param valence - 快度 [3.4～4.6]（中心: 4.0）
 * @param dominance - 優位度 [3.4～4.6]（中心: 4.0）※補助的に使用
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
      color: 'text-gray-600',
      description: '特に感情的な変化が見られない落ち着いた状態',
    };
  }

  // 2. 高覚醒（A >= 4.2）
  if (arousal >= T.HIGH) {
    // 2-1. 高覚醒 × 高快度 = 喜び・楽しい
    if (valence >= T.HIGH) {
      return {
        label: '喜び・楽しい',
        category: 'positive',
        emoji: '😊',
        color: 'text-yellow-500',
        description: '明るく活発な気分、ポジティブなエネルギー',
      };
    }

    // 2-2. 高覚醒 × 低快度 = ストレス or 不安
    if (valence < T.LOW) {
      // Dominanceで補助判定
      if (dominance >= T.HIGH) {
        return {
          label: 'ストレス・緊張',
          category: 'negative',
          emoji: '😰',
          color: 'text-orange-600',
          description: '緊張感やプレッシャーを感じている状態、まだコントロール感がある',
        };
      } else {
        return {
          label: '不安・心配',
          category: 'negative',
          emoji: '😟',
          color: 'text-orange-500',
          description: '不安や心配を感じ、やや圧倒されている状態',
        };
      }
    }
  }

  // 3. 低覚醒（A < 3.8）
  if (arousal < T.LOW) {
    // 3-1. 低覚醒 × 高快度 = 穏やか・リラックス
    if (valence >= T.HIGH) {
      return {
        label: '穏やか・リラックス',
        category: 'positive',
        emoji: '😌',
        color: 'text-green-500',
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
          color: 'text-blue-600',
          description: '悲しみや落ち込みを感じている状態',
        };
      }
    }

    // 3-3. 低覚醒 × 中程度の快度 = 落ち着き
    return {
      label: '落ち着き',
      category: 'positive',
      emoji: '😊',
      color: 'text-blue-400',
      description: '静かで落ち着いた状態、安定している',
    };
  }

  // 4. 中程度の覚醒（3.8 <= A < 4.2）
  if (valence >= T.HIGH) {
    return {
      label: '落ち着き',
      category: 'positive',
      emoji: '🙂',
      color: 'text-blue-400',
      description: '穏やかで満足している状態',
    };
  } else if (valence < T.LOW) {
    return {
      label: '悲しみ',
      category: 'negative',
      emoji: '😢',
      color: 'text-blue-600',
      description: 'やや沈んだ気分、落ち込み傾向',
    };
  }

  // 5. デフォルト（全てが中程度）= 中立
  return {
    label: '中立',
    category: 'neutral',
    emoji: '😐',
    color: 'text-gray-600',
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
    'ストレス・緊張': '😰',
    '不安・心配': '😟',
    '悲しみ': '😢',
    '疲労・無気力': '😴',
    '中立': '😐',
    '落ち着き': '🙂',
  };

  return emojiMap[label] || '😐';
}

/**
 * 感情ラベルからTailwind CSSカラークラスを取得
 */
export function getEmotionColor(label: string): string {
  const colorMap: Record<string, string> = {
    '喜び・楽しい': 'text-yellow-500',
    '穏やか・リラックス': 'text-green-500',
    'ストレス・緊張': 'text-orange-600',
    '不安・心配': 'text-orange-500',
    '悲しみ': 'text-blue-600',
    '疲労・無気力': 'text-gray-500',
    '中立': 'text-gray-600',
    '落ち着き': 'text-blue-400',
  };

  return colorMap[label] || 'text-gray-600';
}

/**
 * 感情カテゴリを取得
 */
export function getEmotionCategory(label: string): EmotionCategory {
  const positiveLabels = ['喜び・楽しい', '穏やか・リラックス', '落ち着き'];
  const negativeLabels = ['ストレス・緊張', '不安・心配', '悲しみ', '疲労・無気力'];

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

以下の8種類の感情ラベルを使用します：

## ポジティブ感情
1. **喜び・楽しい** (😊): 高覚醒×高快度 - 明るく活発な気分、ポジティブなエネルギー
2. **穏やか・リラックス** (😌): 低覚醒×高快度 - 穏やかでリラックスした状態、心地よい落ち着き
3. **落ち着き** (🙂): 中覚醒×やや高快度 - 静かで落ち着いた状態、安定している

## ネガティブ感情
4. **ストレス・緊張** (😰): 高覚醒×低快度×高優位度 - 緊張感やプレッシャー、まだコントロール感がある
5. **不安・心配** (😟): 高覚醒×低快度×低優位度 - 不安や心配、やや圧倒されている
6. **悲しみ** (😢): 低覚醒×低快度 - 悲しみや落ち込み
7. **疲労・無気力** (😴): 極低覚醒×低快度 - エネルギー低下、疲れや無気力

## 中立
8. **中立** (😐): 全て中央付近 - 特に感情的な変化が見られない状態

**重要**: これらのラベルはVAD値（覚醒度・快度・優位度）に基づいて自動判定されています。
ユーザーの発言内容と感情ラベルを照らし合わせて、より深い理解を促す質問をしてください。
`.trim();
}
