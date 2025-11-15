'use client';

import { Card } from '@/components/ui/Card';
import { FileText } from 'lucide-react';
import { TranscriptionSegment } from '@/types/database';

interface TranscriptionSegmentsCardProps {
  segments: TranscriptionSegment[];
}

/**
 * 感情ラベルから色を取得
 */
function getEmotionColor(emotionLabel: string | null): string {
  if (!emotionLabel) return 'text-foreground'; // デフォルト（中立は黒）

  const label = emotionLabel.toLowerCase();

  // 喜び・興奮系 - 金色/黄色
  if (label.includes('喜び') || label.includes('興奮') || label.includes('満足')) {
    return 'text-yellow-500';
  }

  // 悲しみ・疲労系 - 青
  if (label.includes('悲し') || label.includes('疲労') || label.includes('疲れ')) {
    return 'text-blue-500';
  }

  // ストレス・緊張系 - 赤
  if (label.includes('ストレス') || label.includes('緊張')) {
    return 'text-red-500';
  }

  // 落ち込み系 - 紫
  if (label.includes('落ち込') || label.includes('沈')) {
    return 'text-purple-500';
  }

  // 穏やか・リラックス系 - 緑
  if (label.includes('穏やか') || label.includes('リラックス')) {
    return 'text-green-500';
  }

  // 中立 - 黒（デフォルト）
  return 'text-foreground';
}

/**
 * 感情ラベルから絵文字を取得
 */
function getEmotionEmoji(emotionLabel: string | null): string {
  if (!emotionLabel) return '';

  const label = emotionLabel.toLowerCase();

  if (label.includes('喜び') || label.includes('興奮')) return '😄';
  if (label.includes('満足')) return '😊';
  if (label.includes('悲し')) return '😢';
  if (label.includes('疲労') || label.includes('疲れ')) return '😴';
  if (label.includes('ストレス') || label.includes('緊張')) return '😰';
  if (label.includes('落ち込') || label.includes('沈')) return '😔';
  if (label.includes('穏やか') || label.includes('リラックス')) return '😌';
  if (label.includes('中立')) return '😐';

  return '';
}

export function TranscriptionSegmentsCard({ segments }: TranscriptionSegmentsCardProps) {
  console.log('[TranscriptionSegmentsCard] Received segments:', segments);
  console.log('[TranscriptionSegmentsCard] Segments count:', segments?.length || 0);

  if (!segments || segments.length === 0) {
    console.log('[TranscriptionSegmentsCard] No segments to display - returning null');
    return null;
  }

  console.log('[TranscriptionSegmentsCard] Rendering card with segments');

  return (
    <Card className="glass soft-shadow rounded-[20px] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">感情付き文字起こし</h2>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-4">
          色はその文章を話している時の感情を表しています
        </p>

        <div className="leading-relaxed text-base">
          {segments.map((segment, index) => (
            <span
              key={segment.id || index}
              className={`${getEmotionColor(segment.emotion_label)} transition-colors`}
              title={
                segment.emotion_label
                  ? `${getEmotionEmoji(segment.emotion_label)} ${segment.emotion_label} (${segment.start_time.toFixed(1)}s - ${segment.end_time.toFixed(1)}s)`
                  : `${segment.start_time.toFixed(1)}s - ${segment.end_time.toFixed(1)}s`
              }
            >
              {segment.text}
            </span>
          ))}
        </div>

        {/* 凡例 */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">感情の色分け</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">●</span>
              <span>喜び・興奮</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-blue-500">●</span>
              <span>悲しみ・疲労</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-red-500">●</span>
              <span>ストレス・緊張</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-purple-500">●</span>
              <span>落ち込み</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-green-500">●</span>
              <span>穏やか</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-foreground">●</span>
              <span>中立</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
