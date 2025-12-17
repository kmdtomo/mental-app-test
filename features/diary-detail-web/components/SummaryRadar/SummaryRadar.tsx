'use client';

import React, { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';

interface EmotionPoint {
  id: string;
  timestamp: number;
  formattedTime: string;
  arousal: number;
  valence: number;
  speaker: 'user' | 'model';
  text: string;
  emotionLabel?: string;
}

interface SummaryRadarProps {
  data: EmotionPoint[];
}

// DBのemotion_labelからレーダーチャート用のカテゴリにマッピング
const EMOTION_LABEL_TO_CATEGORY: Record<string, string> = {
  '喜び・楽しい': '喜び',
  '穏やか・リラックス': '穏やかさ',
  '落ち着き': '穏やかさ',
  'ストレス・緊張': 'ストレス',
  '不安・心配': 'ストレス',
  '怒り・イライラ': '怒り',
  '悲しみ': '悲しみ',
  '疲労・無気力': '悲しみ',
  '中立': '中立',
};

export function SummaryRadar({ data }: SummaryRadarProps) {
  const stats = useMemo(() => {
    // DBのemotion_labelを使って感情カテゴリごとの出現回数をカウント
    const categoryCounts: Record<string, number> = {
      '喜び': 0,
      '穏やかさ': 0,
      'ストレス': 0,
      '怒り': 0,
      '悲しみ': 0,
    };

    // 感情ラベルがあるデータのみをカウント
    let labeledCount = 0;
    data.forEach(p => {
      if (p.emotionLabel) {
        const category = EMOTION_LABEL_TO_CATEGORY[p.emotionLabel];
        // 中立は除外
        if (category && category !== '中立' && category in categoryCounts) {
          categoryCounts[category]++;
          labeledCount++;
        }
      }
    });

    // デバッグログ
    console.log('=== SummaryRadar Debug ===');
    console.log('Total data points:', data.length);
    console.log('Labeled count (excluding neutral):', labeledCount);
    console.log('Category counts:', categoryCounts);

    // 最大値を基準にして正規化（グラフが常に外枠まで広がるようにする）
    const maxCount = Math.max(...Object.values(categoryCounts));
    const denominator = maxCount || 1; // 0除算を防ぐ

    // 各カテゴリの割合をパーセンテージで計算（最大値を100%とする）
    const result = [
      { subject: '喜び', A: Math.round((categoryCounts['喜び'] / denominator) * 100), fullMark: 100 },
      { subject: '穏やかさ', A: Math.round((categoryCounts['穏やかさ'] / denominator) * 100), fullMark: 100 },
      { subject: 'ストレス', A: Math.round((categoryCounts['ストレス'] / denominator) * 100), fullMark: 100 },
      { subject: '怒り', A: Math.round((categoryCounts['怒り'] / denominator) * 100), fullMark: 100 },
      { subject: '悲しみ', A: Math.round((categoryCounts['悲しみ'] / denominator) * 100), fullMark: 100 },
    ];
    console.log('Result stats:', result);
    return result;
  }, [data]);

  return (
    <div className="w-full h-full relative font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="70%"
          data={stats}
          margin={{ top: 5, right: 30, bottom: 5, left: 30 }}
        >
          <PolarGrid stroke="#E5E0DB" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#6B5F58', fontSize: 13, fontWeight: 'bold' }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Session"
            dataKey="A"
            stroke="#C17B68"
            strokeWidth={2}
            fill="#C17B68"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
