'use client';

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  Label,
  ReferenceLine
} from 'recharts';

interface EmotionPoint {
  id: string;
  timestamp: number;
  formattedTime: string;
  arousal: number;
  valence: number;
  dominance?: number;
  speaker: 'user' | 'model';
  text: string;
  emotionLabel?: string; // 8種類の感情ラベル
}

// 感情ラベルに対応する色（valenceベースのグラデーション）
const emotionLabelColors: Record<string, string> = {
  '喜び・楽しい': '#10B981',       // 緑（最もポジティブ）
  '穏やか・リラックス': '#34D399', // 薄緑
  '落ち着き': '#5EEAD4',          // ティール
  '中立': '#C17B68',              // 茶色（中央）
  'ストレス・緊張': '#F59E0B',    // オレンジ
  '不安・心配': '#F97316',        // オレンジ赤
  '悲しみ': '#FB7185',            // ピンク赤
  '疲労・無気力': '#F43F5E',      // 赤（最もネガティブ）
};

interface EmotionChartProps {
  data: EmotionPoint[];
  compact?: boolean; // コンパクトモード（小さいUI向け）
}

// emotion_labelに基づいたY軸位置（0-1の範囲）
const emotionLabelYPosition: Record<string, number> = {
  '喜び・楽しい': 0.9,        // 最上部
  '穏やか・リラックス': 0.78, // 上部
  '落ち着き': 0.65,           // やや上
  '中立': 0.5,                // 中央
  'ストレス・緊張': 0.38,     // やや下
  '不安・心配': 0.28,         // 下部
  '悲しみ': 0.18,             // 下部
  '疲労・無気力': 0.1,        // 最下部
};

export function EmotionChart({ data, compact = false }: EmotionChartProps) {
  // Process data - インデックスベースで均等配置（時間差に関係なく）
  const processedData = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, index) => {
      // emotionLabelがあればその位置を使用、なければvalenceを使用
      const yPosition = d.emotionLabel
        ? (emotionLabelYPosition[d.emotionLabel] ?? 0.5)
        : d.valence;
      return {
        ...d,
        // インデックスベースで均等に配置（録音間の時間差を無視）
        relativeTime: index,
        visualValence: Math.max(0.1, Math.min(0.9, yPosition))
      };
    });
  }, [data]);

  // Find Peak and Low points
  const { maxPoint, minPoint } = useMemo(() => {
    if (processedData.length < 3) return { maxPoint: null, minPoint: null };

    let max = processedData[0];
    let min = processedData[0];

    processedData.forEach(p => {
      if (p.valence > max.valence) max = p;
      if (p.valence < min.valence) min = p;
    });

    if (Math.abs(max.valence - min.valence) < 0.25) return { maxPoint: null, minPoint: null };

    return { maxPoint: max, minPoint: min };
  }, [processedData]);

  const POSITIVE_COLOR = '#10B981';
  const NEUTRAL_COLOR = '#C17B68';
  const NEGATIVE_COLOR = '#F43F5E';

  const getEmotionColor = (valence: number): string => {
    if (valence >= 0.6) return POSITIVE_COLOR;
    if (valence >= 0.4) return NEUTRAL_COLOR;
    return NEGATIVE_COLOR;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      if (!point.text) return null;

      // emotionLabelがある場合はその色を使用、なければvalenceから計算
      const emotionLabel = point.emotionLabel || '中立';
      const color = emotionLabelColors[emotionLabel] || getEmotionColor(point.valence);

      return (
        <div className="bg-[#FAF5F0]/95 backdrop-blur-md p-4 shadow-xl shadow-[#C17B68]/10 rounded-2xl border border-[#C17B68]/20 max-w-[280px]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
              <span className="text-[11px] font-bold" style={{ color }}>{emotionLabel}</span>
            </div>
            <span className="text-[10px] text-[#6B5F58] font-medium">{point.formattedTime}</span>
          </div>
          <p className="text-sm font-medium text-[#3D3632] leading-snug mb-2">&quot;{point.text}&quot;</p>
          {/* VAD値（実験用） */}
          <div className="pt-2 border-t border-[#C17B68]/10">
            <div className="flex gap-3 text-[10px] font-mono text-[#6B5F58]">
              <span>V: {point.valence?.toFixed(2) ?? '-'}</span>
              <span>A: {point.arousal?.toFixed(2) ?? '-'}</span>
              <span>D: {point.dominance?.toFixed(2) ?? '-'}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    // emotionLabelがあればその色を使用、なければvalenceから計算
    const color = payload.emotionLabel
      ? (emotionLabelColors[payload.emotionLabel] || getEmotionColor(payload.valence))
      : getEmotionColor(payload.valence);
    const isSignificant = payload.speaker === 'user' || payload === maxPoint || payload === minPoint;

    if (!isSignificant) return null;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={compact ? 3 : 4}
        fill="white"
        stroke={color}
        strokeWidth={compact ? 2 : 2.5}
        className="transition-all duration-300 hover:r-6 cursor-pointer"
      />
    );
  };

  // コンパクトモードの場合
  if (compact) {
    return (
      <div className="w-full h-full relative overflow-visible font-sans">
        {/* 縦軸ラベル - コンパクト版（4項目維持） */}
        <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between py-1 pointer-events-none z-10">
          <span className="text-[9px] font-bold text-emerald-500/80 leading-none">喜び・楽しい</span>
          <span className="text-[9px] font-bold text-green-500/80 leading-none">穏やか</span>
          <span className="text-[9px] font-bold text-orange-500/80 leading-none">ストレス</span>
          <span className="text-[9px] font-bold text-rose-500/80 leading-none">悲しみ</span>
        </div>

        <div className="ml-16 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={processedData}
              margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="lineGradientCompact" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="10%" stopColor={POSITIVE_COLOR} />
                  <stop offset="50%" stopColor={NEUTRAL_COLOR} />
                  <stop offset="90%" stopColor={NEGATIVE_COLOR} />
                </linearGradient>
                <filter id="shadowCompact" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#C17B68" floodOpacity="0.15"/>
                </filter>
              </defs>

              <ReferenceLine y={0.5} stroke="#E5E0DB" strokeWidth={1} strokeDasharray="4 4" />

              <XAxis dataKey="relativeTime" type="number" hide={true} domain={['dataMin', 'dataMax']} />
              <YAxis domain={[0, 1]} hide={true} />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#C17B68', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.5 }}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="visualValence"
                stroke="url(#lineGradientCompact)"
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                animationDuration={800}
                filter="url(#shadowCompact)"
              />

              <Scatter
                dataKey="visualValence"
                shape={<CustomDot />}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // 通常モード（大きいUI向け）
  return (
    <div className="w-full h-full pt-12 pr-6 pl-2 pb-2 relative overflow-visible font-sans">
      {/* 縦軸ラベル - グラフ領域に合わせて配置 */}
      <div className="absolute left-0 top-12 bottom-2 w-20 flex flex-col justify-between pointer-events-none z-10">
        <span className="text-[10px] font-bold text-emerald-500/80 tracking-widest leading-none">喜び・楽しい</span>
        <span className="text-[10px] font-bold text-green-500/80 tracking-widest leading-none">穏やか</span>
        <span className="text-[10px] font-bold text-orange-500/80 tracking-widest leading-none">ストレス</span>
        <span className="text-[10px] font-bold text-rose-500/80 tracking-widest leading-none">悲しみ</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 20, left: 30, bottom: 20 }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="10%" stopColor={POSITIVE_COLOR} />
              <stop offset="50%" stopColor={NEUTRAL_COLOR} />
              <stop offset="90%" stopColor={NEGATIVE_COLOR} />
            </linearGradient>
            <filter id="shadow" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#C17B68" floodOpacity="0.15"/>
            </filter>
          </defs>

          <ReferenceLine y={0.5} stroke="#E5E0DB" strokeWidth={2} strokeDasharray="6 6" />

          <XAxis
            dataKey="relativeTime"
            type="number"
            hide={true}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis domain={[0, 1]} hide={true} />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#C17B68', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.5 }}
            isAnimationActive={false}
          />

          <Line
            type="monotone"
            dataKey="visualValence"
            stroke="url(#lineGradient)"
            strokeWidth={3.5}
            dot={false}
            activeDot={false}
            animationDuration={1500}
            filter="url(#shadow)"
          />

          <Scatter
            dataKey="visualValence"
            shape={<CustomDot />}
            isAnimationActive={false}
          />

          {maxPoint && (
            <ReferenceDot x={maxPoint.relativeTime} y={maxPoint.visualValence} r={0}>
              <Label
                content={({viewBox}: any) => (
                  <g transform={`translate(${viewBox.x}, ${viewBox.y - 20})`}>
                    <rect x="-30" y="-14" width="60" height="24" rx="12" fill="white" className="shadow-sm shadow-[#C17B68]/20"/>
                    <text x="0" y="2" textAnchor="middle" fontSize="10" fontWeight="bold" fill={POSITIVE_COLOR}>最高潮</text>
                  </g>
                )}
              />
            </ReferenceDot>
          )}

          {minPoint && (
            <ReferenceDot x={minPoint.relativeTime} y={minPoint.visualValence} r={0}>
              <Label
                content={({viewBox}: any) => (
                  <g transform={`translate(${viewBox.x}, ${viewBox.y + 25})`}>
                    <rect x="-30" y="-10" width="60" height="24" rx="12" fill="white" className="shadow-sm shadow-[#C17B68]/20"/>
                    <text x="0" y="6" textAnchor="middle" fontSize="10" fontWeight="bold" fill={NEGATIVE_COLOR}>最低</text>
                  </g>
                )}
              />
            </ReferenceDot>
          )}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
