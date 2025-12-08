'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { EMOTION_COLORS, NEUTRAL_GRADIENT_COLOR } from '@/lib/emotionLabeling';

interface EmotionPoint {
  id: string;
  timestamp: number;
  formattedTime: string;
  arousal: number;
  valence: number;
  speaker: 'user' | 'model';
  text: string;
}

interface MiniEmotionChartProps {
  data: EmotionPoint[];
}

export function MiniEmotionChart({ data }: MiniEmotionChartProps) {
  const processedData = useMemo(() => {
    if (data.length === 0) return [];
    const startTime = data[0].timestamp;
    return data.map((d, index) => ({
      ...d,
      relativeTime: (d.timestamp - startTime) / 1000,
      visualValence: Math.max(0.1, Math.min(0.9, d.valence)),
      index,
    }));
  }, [data]);

  // 統一色定義を使用
  const POSITIVE_COLOR = EMOTION_COLORS['喜び・楽しい'];
  const NEUTRAL_COLOR = NEUTRAL_GRADIENT_COLOR;  // グラデーション用
  const NEGATIVE_COLOR = EMOTION_COLORS['怒り・イライラ'];

  const getEmotionColor = (valence: number): string => {
    if (valence >= 0.6) return POSITIVE_COLOR;
    if (valence >= 0.4) return NEUTRAL_COLOR;
    return NEGATIVE_COLOR;
  };

  // 開始と終了の感情レベルを取得
  const startValence = processedData[0]?.valence ?? 0.5;
  const endValence = processedData[processedData.length - 1]?.valence ?? 0.5;
  const trend = endValence - startValence;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      if (!point.text) return null;
      const color = getEmotionColor(point.valence);

      return (
        <div className="bg-white/95 backdrop-blur-sm p-2 shadow-lg rounded-lg border border-[#F5EBE0] max-w-[180px]">
          <p className="text-xs text-[#3D3632] leading-snug">{point.text}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
            <span className="text-[10px] text-[#9A8D85]">{point.formattedTime}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex items-center gap-3">
      {/* 開始インジケーター */}
      <div className="flex flex-col items-center">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: getEmotionColor(startValence) }}
        />
        <span className="text-[9px] text-[#9A8D85] mt-0.5">始</span>
      </div>

      {/* グラフ本体 */}
      <div className="flex-1 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={processedData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <defs>
              <linearGradient id="miniGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={POSITIVE_COLOR} stopOpacity={0.3} />
                <stop offset="50%" stopColor={NEUTRAL_COLOR} stopOpacity={0.2} />
                <stop offset="100%" stopColor={NEGATIVE_COLOR} stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="miniLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="10%" stopColor={POSITIVE_COLOR} />
                <stop offset="50%" stopColor={NEUTRAL_COLOR} />
                <stop offset="90%" stopColor={NEGATIVE_COLOR} />
              </linearGradient>
            </defs>

            <XAxis dataKey="relativeTime" type="number" hide={true} domain={['dataMin', 'dataMax']} />
            <YAxis domain={[0, 1]} hide={true} />

            <Tooltip
              content={<CustomTooltip />}
              cursor={false}
              isAnimationActive={false}
            />

            <Area
              type="monotone"
              dataKey="visualValence"
              stroke="url(#miniLineGradient)"
              strokeWidth={2.5}
              fill="url(#miniGradient)"
              animationDuration={800}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const color = getEmotionColor(payload.valence);
                return (
                  <circle
                    key={payload.id}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill="white"
                    stroke={color}
                    strokeWidth={2}
                  />
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 終了インジケーター + トレンド */}
      <div className="flex flex-col items-center">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: getEmotionColor(endValence) }}
        />
        <span className="text-[9px] text-[#9A8D85] mt-0.5">終</span>
      </div>

      {/* トレンドバッジ */}
      <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${
        trend > 0.15
          ? 'bg-emerald-100 text-emerald-600'
          : trend < -0.15
            ? 'bg-rose-100 text-rose-600'
            : 'bg-gray-100 text-gray-500'
      }`}>
        {trend > 0.15 ? '↗ 改善' : trend < -0.15 ? '↘ 低下' : '→ 安定'}
      </div>
    </div>
  );
}
