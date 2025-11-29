import React, { useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { EmotionPoint } from '../types';

interface SummaryRadarProps {
  data: EmotionPoint[];
}

const SummaryRadar: React.FC<SummaryRadarProps> = ({ data }) => {
  const stats = useMemo(() => {
    // Default empty state
    if (data.length < 2) return [
      { subject: '肯定感', A: 0, fullMark: 100 },
      { subject: 'エネルギー', A: 0, fullMark: 100 },
      { subject: '安定性', A: 0, fullMark: 100 },
      { subject: '回復力', A: 0, fullMark: 100 },
      { subject: '没入度', A: 0, fullMark: 100 },
    ];

    const avgValence = data.reduce((acc, p) => acc + p.valence, 0) / data.length;
    const avgArousal = data.reduce((acc, p) => acc + p.arousal, 0) / data.length;
    const variance = data.reduce((acc, p) => acc + Math.pow(p.valence - avgValence, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    const stability = Math.max(0, 1 - (stdDev * 2.5));

    let minVal = 1;
    let endVal = data[data.length - 1].valence;
    data.forEach(p => { if (p.valence < minVal) minVal = p.valence; });
    const recovery = Math.max(0, endVal - minVal);
    const recoveryScore = Math.min(1, recovery * 1.5);

    const engagement = Math.min(1, data.length / 8);

    return [
      { subject: '肯定感', A: Math.round(avgValence * 100), fullMark: 100 },
      { subject: 'エネルギー', A: Math.round(avgArousal * 100), fullMark: 100 },
      { subject: '安定性', A: Math.round(stability * 100), fullMark: 100 },
      { subject: '回復力', A: Math.round(recoveryScore * 100), fullMark: 100 },
      { subject: '没入度', A: Math.round(engagement * 100), fullMark: 100 },
    ];
  }, [data]);

  return (
    <div className="w-full h-full relative font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={stats}>
          <PolarGrid stroke="#E5E0DB" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#6B5F58', fontSize: 11, fontWeight: 700 }} 
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
      
      {/* Center Score Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <div className="text-[10px] font-bold text-[#C17B68] bg-white/70 backdrop-blur-sm px-2 py-1 rounded-full border border-[#C17B68]/30">
            スコア
         </div>
      </div>
    </div>
  );
};

export default SummaryRadar;