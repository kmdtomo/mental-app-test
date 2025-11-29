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
}

interface SummaryRadarProps {
  data: EmotionPoint[];
}

export function SummaryRadar({ data }: SummaryRadarProps) {
  const stats = useMemo(() => {
    // 感情カテゴリごとのスコアを計算
    const joyScores = data.filter(p => p.valence > 0.6 && p.arousal > 0.5).map(p => p.valence);
    const calmScores = data.filter(p => p.valence > 0.6 && p.arousal <= 0.5).map(p => p.valence);
    const stressScores = data.filter(p => p.valence < 0.4 && p.arousal > 0.5).map(p => 1 - p.valence);
    const sadnessScores = data.filter(p => p.valence < 0.4 && p.arousal <= 0.5).map(p => 1 - p.valence);
    const arousalScores = data.map(p => p.arousal);

    const getAverage = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return [
      { subject: '喜び', A: Math.round(getAverage(joyScores) * 100), fullMark: 100 },
      { subject: '穏やかさ', A: Math.round(getAverage(calmScores) * 100), fullMark: 100 },
      { subject: 'ストレス', A: Math.round(getAverage(stressScores) * 100), fullMark: 100 },
      { subject: '悲しみ', A: Math.round(getAverage(sadnessScores) * 100), fullMark: 100 },
      { subject: '活性度', A: Math.round(getAverage(arousalScores) * 100), fullMark: 100 },
    ];
  }, [data]);

  return (
    <div className="w-full h-full relative font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={stats}>
          <PolarGrid stroke="#E5E0DB" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#6B5F58', fontSize: 12, fontWeight: 'bold' }}
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
