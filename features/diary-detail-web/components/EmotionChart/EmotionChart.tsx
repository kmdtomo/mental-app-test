'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
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
import { EMOTION_COLORS, EMOTION_Y_POSITION, getEmotionHexColor } from '@/lib/emotionLabeling';

interface EmotionPoint {
  id: string;
  timestamp: number;
  formattedTime: string;
  arousal: number;
  valence: number;
  dominance?: number;
  speaker: 'user' | 'model';
  text: string;
  emotionLabel?: string; // 9種類の感情ラベル
}

interface EmotionChartProps {
  data: EmotionPoint[];
  compact?: boolean; // コンパクトモード（小さいUI向け）
}

export function EmotionChart({ data, compact = false }: EmotionChartProps) {
  // Process data - インデックスベースで均等配置（時間差に関係なく）
  const processedData = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, index) => {
      // emotionLabelがあればその位置を使用、なければvalenceを使用
      const yPosition = d.emotionLabel
        ? (EMOTION_Y_POSITION[d.emotionLabel] ?? 0.5)
        : d.valence;
      return {
        ...d,
        // インデックスベースで均等に配置（録音間の時間差を無視）
        relativeTime: index,
        visualValence: Math.max(0.05, Math.min(0.95, yPosition))
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

  // グラデーション用の色（EMOTION_Y_POSITIONに対応）
  // Y軸: 1(上) → 0(下) なので、offset: 0%(上) → 100%(下)
  // 喜び(0.9) → 穏やか(0.78) → 落ち着き(0.65) → 中立(0.5) → ストレス(0.38) → 不安(0.28) → 悲しみ(0.18) → 疲労(0.1) → 怒り(0.05)
  const GRADIENT_COLORS = {
    joy: EMOTION_COLORS['喜び・楽しい'],       // #F59E0B amber (Y=0.9, offset=10%)
    calm: EMOTION_COLORS['穏やか・リラックス'], // #10B981 emerald (Y=0.78, offset=22%)
    neutral: '#D1D5DB',                        // gray-300 (Y=0.5, offset=50%)
    stress: EMOTION_COLORS['ストレス・緊張'],   // #F97316 orange (Y=0.38, offset=62%)
    sad: EMOTION_COLORS['悲しみ'],             // #3B82F6 blue (Y=0.18, offset=82%)
    fatigue: EMOTION_COLORS['疲労・無気力'],    // #6B7280 gray (Y=0.1, offset=90%)
    anger: EMOTION_COLORS['怒り・イライラ'],    // #EF4444 red (Y=0.05, offset=95%)
  };

  // チャートの高さを取得してグラデーションを絶対座標で適用するためのロジック
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartHeight(entry.contentRect.height);
      }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      if (!point.text) return null;

      // emotionLabelがある場合はその色を使用
      const emotionLabel = point.emotionLabel || '中立';
      const color = getEmotionHexColor(emotionLabel);

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
    // emotionLabelがあればその色を使用
    const color = getEmotionHexColor(payload.emotionLabel || '中立');
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
    const margin = { top: 5, right: 15, left: 10, bottom: 5 };
    // userSpaceOnUse用の座標計算
    // Y軸は上(0)から下(height)へ。
    // 値1.0 (Top) -> margin.top
    // 値0.0 (Bottom) -> chartHeight - margin.bottom
    const y1 = margin.top;
    const y2 = chartHeight - margin.bottom;

    return (
      <div ref={containerRef} className="w-full h-full relative overflow-visible font-sans">
        {/* 縦軸ラベル - コンパクト版（主要感情のみ） */}
        <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between py-1 pointer-events-none z-10">
          <span className="text-[9px] font-bold text-amber-500/80 leading-none">喜び</span>
          <span className="text-[9px] font-bold text-emerald-500/80 leading-none">穏やか</span>
          <span className="text-[9px] font-bold text-gray-400/80 leading-none">中立</span>
          <span className="text-[9px] font-bold text-orange-500/80 leading-none">ストレス</span>
          <span className="text-[9px] font-bold text-blue-500/80 leading-none">悲しみ</span>
        </div>

        <div className="ml-16 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={processedData}
              margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
            >
              <defs>
                {/* Y軸に沿ったグラデーション（絶対座標指定） */}
                {/* gradientUnits="userSpaceOnUse" を使用してデータ範囲に依存しない色指定を行う */}
                <linearGradient id="lineGradientCompact" gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
                  <stop offset="10%" stopColor={GRADIENT_COLORS.joy} />
                  <stop offset="22%" stopColor={GRADIENT_COLORS.calm} />
                  <stop offset="50%" stopColor={GRADIENT_COLORS.neutral} />
                  <stop offset="62%" stopColor={GRADIENT_COLORS.stress} />
                  {/* 悲しみ(Blue)の範囲を広げて、0.18付近で確実に青くなるようにする */}
                  <stop offset="78%" stopColor={GRADIENT_COLORS.sad} />
                  <stop offset="86%" stopColor={GRADIENT_COLORS.sad} />
                  <stop offset="92%" stopColor={GRADIENT_COLORS.fatigue} />
                  <stop offset="96%" stopColor={GRADIENT_COLORS.anger} />
                </linearGradient>
                <filter id="shadowCompact" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#C17B68" floodOpacity="0.15" />
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
  // 最高点・最低点の色を取得
  const maxPointColor = maxPoint ? getEmotionHexColor(maxPoint.emotionLabel || '喜び・楽しい') : GRADIENT_COLORS.joy;
  const minPointColor = minPoint ? getEmotionHexColor(minPoint.emotionLabel || '悲しみ') : GRADIENT_COLORS.sad;

  const margin = { top: 20, right: 20, left: 30, bottom: 20 };
  const y1 = margin.top;
  const y2 = chartHeight - margin.bottom;

  return (
    <div ref={containerRef} className="w-full h-full pt-12 pr-6 pl-2 pb-2 relative overflow-visible font-sans">
      {/* 縦軸ラベル - グラフ領域に合わせて配置（主要感情） */}
      {/* 縦軸ラベル - YAxisで制御するため削除 */}

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 20, left: 30, bottom: 20 }}
        >
          <defs>
            {/* Y軸に沿ったグラデーション（絶対座標指定） */}
            <linearGradient id="lineGradient" gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
              <stop offset="10%" stopColor={GRADIENT_COLORS.joy} />
              <stop offset="22%" stopColor={GRADIENT_COLORS.calm} />
              <stop offset="50%" stopColor={GRADIENT_COLORS.neutral} />
              <stop offset="62%" stopColor={GRADIENT_COLORS.stress} />
              {/* 悲しみ(Blue)の範囲を広げて、0.18付近で確実に青くなるようにする */}
              <stop offset="78%" stopColor={GRADIENT_COLORS.sad} />
              <stop offset="86%" stopColor={GRADIENT_COLORS.sad} />
              <stop offset="92%" stopColor={GRADIENT_COLORS.fatigue} />
              <stop offset="96%" stopColor={GRADIENT_COLORS.anger} />
            </linearGradient>
            <filter id="shadow" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#C17B68" floodOpacity="0.15" />
            </filter>
          </defs>

          <ReferenceLine y={0.5} stroke="#E5E0DB" strokeWidth={2} strokeDasharray="6 6" />

          <XAxis
            dataKey="relativeTime"
            type="number"
            hide={true}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0.9, 0.78, 0.5, 0.38, 0.18]}
            axisLine={false}
            tickLine={false}
            width={40}
            tick={({ x, y, payload }) => {
              const config = {
                0.9: { label: '喜び', color: '#F59E0B' },
                0.78: { label: '穏やか', color: '#10B981' },
                0.5: { label: '中立', color: '#9CA3AF' },
                0.38: { label: 'ストレス', color: '#F97316' },
                0.18: { label: '悲しみ', color: '#3B82F6' },
              }[payload.value as number];

              if (!config) return null;

              return (
                <text x={x} y={y} dy={3} textAnchor="end" fontSize={10} fontWeight="bold" fill={config.color} opacity={0.8}>
                  {config.label}
                </text>
              );
            }}
          />

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
                content={({ viewBox }: any) => (
                  <g transform={`translate(${viewBox.x}, ${viewBox.y - 20})`}>
                    <rect x="-30" y="-14" width="60" height="24" rx="12" fill="white" className="shadow-sm shadow-[#C17B68]/20" />
                    <text x="0" y="2" textAnchor="middle" fontSize="10" fontWeight="bold" fill={maxPointColor}>最高潮</text>
                  </g>
                )}
              />
            </ReferenceDot>
          )}

          {minPoint && (
            <ReferenceDot x={minPoint.relativeTime} y={minPoint.visualValence} r={0}>
              <Label
                content={({ viewBox }: any) => (
                  <g transform={`translate(${viewBox.x}, ${viewBox.y + 25})`}>
                    <rect x="-30" y="-10" width="60" height="24" rx="12" fill="white" className="shadow-sm shadow-[#C17B68]/20" />
                    <text x="0" y="6" textAnchor="middle" fontSize="10" fontWeight="bold" fill={minPointColor}>最低</text>
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
