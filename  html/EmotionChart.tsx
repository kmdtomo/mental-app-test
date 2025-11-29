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
import { EmotionPoint } from '../types';

interface EmotionChartProps {
  data: EmotionPoint[];
}

const EmotionChart: React.FC<EmotionChartProps> = ({ data }) => {
  // Process data to relative time
  const processedData = useMemo(() => {
    if (data.length === 0) return [];
    const startTime = data[0].timestamp;
    return data.map(d => ({
      ...d,
      relativeTime: (d.timestamp - startTime) / 1000,
      visualValence: Math.max(0.1, Math.min(0.9, d.valence)) // Keep within visible bounds
    }));
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

  // Gradient Colors matching the warm theme
  const POSITIVE_COLOR = '#10B981'; // Emerald
  const NEUTRAL_COLOR = '#C17B68';  // Terracotta (Theme Color)
  const NEGATIVE_COLOR = '#F43F5E'; // Rose

  const getEmotionColor = (valence: number): string => {
    if (valence >= 0.6) return POSITIVE_COLOR;
    if (valence >= 0.4) return NEUTRAL_COLOR;
    return NEGATIVE_COLOR;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      if (!point.text) return null;
      const color = getEmotionColor(point.valence);

      return (
        <div className="bg-[#FAF5F0]/95 backdrop-blur-md p-4 shadow-xl shadow-[#C17B68]/10 rounded-2xl border border-[#C17B68]/20 max-w-[240px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
            <span className="text-[10px] text-[#6B5F58] uppercase font-bold tracking-wider">{point.formattedTime}</span>
          </div>
          <p className="text-sm font-medium text-[#3D3632] leading-snug">"{point.text}"</p>
        </div>
      );
    }
    return null;
  };

  // Minimal Dot
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = getEmotionColor(payload.valence);
    // Only show dots for user turns or significant shifts to reduce noise
    const isSignificant = payload.speaker === 'user' || payload === maxPoint || payload === minPoint;
    
    if (!isSignificant) return null;

    return (
      <circle 
        cx={cx} 
        cy={cy} 
        r={4} 
        fill="white" 
        stroke={color} 
        strokeWidth={2.5}
        className="transition-all duration-300 hover:r-6 cursor-pointer"
      />
    );
  };

  return (
    <div className="w-full h-full pt-12 pr-6 pl-2 pb-2 relative overflow-visible font-sans">
       {/* Axis Labels */}
       <div className="absolute left-6 top-8 text-[10px] font-bold text-emerald-500/60 tracking-widest pointer-events-none z-10">
          ポジティブ
       </div>
       <div className="absolute left-6 bottom-8 text-[10px] font-bold text-rose-500/60 tracking-widest pointer-events-none z-10">
          ネガティブ
       </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={processedData}
          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
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

          {/* Clean Neutral Line */}
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

          {/* The Hero Line */}
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

          {/* Elegant Annotations */}
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
};

export default EmotionChart;