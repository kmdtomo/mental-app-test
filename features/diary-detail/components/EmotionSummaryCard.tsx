'use client';

import { Card } from '@/components/ui/Card';
import { Heart } from 'lucide-react';

interface EmotionSummaryCardProps {
  avgArousal: number | null;
  avgValence: number | null;
  avgDominance: number | null;
  aiInsights: string | null;
}

export function EmotionSummaryCard({
  avgArousal,
  avgValence,
  avgDominance,
  aiInsights
}: EmotionSummaryCardProps) {
  console.log('=== EmotionSummaryCard Render ===');
  console.log('avgArousal:', avgArousal);
  console.log('avgValence:', avgValence);
  console.log('avgDominance:', avgDominance);
  console.log('aiInsights:', aiInsights);

  // 感情データまたはAI要約が存在する場合に表示
  const hasEmotionData = avgArousal != null && avgValence != null && avgDominance != null;
  const hasAnyData = hasEmotionData || aiInsights;

  console.log('hasEmotionData:', hasEmotionData);
  console.log('hasAnyData:', hasAnyData);

  // データがない場合は何も表示しない
  if (!hasAnyData) {
    console.log('EmotionSummaryCard - No data, returning null');
    return null;
  }

  console.log('EmotionSummaryCard - Rendering card');

  return (
    <Card className="glass soft-shadow rounded-[20px] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-primary/10">
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">感情サマリー [NEW VERSION]</h2>
      </div>

      {/* AI感情要約 */}
      {aiInsights && (
        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-sm leading-relaxed">
            {aiInsights}
          </p>
        </div>
      )}

      {/* VAD値 */}
      {hasEmotionData && (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">覚醒度</span>
            <span className="text-sm font-mono">{avgArousal!.toFixed(2)} / 5.0</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(avgArousal! / 5) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">快度</span>
            <span className="text-sm font-mono">{avgValence!.toFixed(2)} / 5.0</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(avgValence! / 5) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">優位性</span>
            <span className="text-sm font-mono">{avgDominance!.toFixed(2)} / 5.0</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(avgDominance! / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>
      )}
    </Card>
  );
}
