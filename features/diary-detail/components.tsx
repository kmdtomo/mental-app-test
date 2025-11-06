'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================
// EmotionSummaryCard Component
// ============================================================

interface EmotionSummaryCardProps {
  avgArousal: number;
  avgValence: number;
  avgDominance: number;
  emotionDistribution: { [key: string]: number };
  totalRecordings: number;
  totalDuration: number;
  aiInsights?: string | null;
}

export function EmotionSummaryCard({
  avgArousal,
  avgValence,
  avgDominance,
  emotionDistribution,
  totalRecordings,
  totalDuration,
  aiInsights
}: EmotionSummaryCardProps) {
  const getEmotionEmoji = (emotion: string) => {
    const emojiMap: { [key: string]: string } = {
      happy: '😊', sad: '😢', angry: '😠', calm: '😌',
      neutral: '😐', excited: '🤩', relaxed: '😎',
      stressed: '😰', tired: '😴'
    };
    return emojiMap[emotion] || '😐';
  };

  const getEmotionLabel = (emotion: string) => {
    const labelMap: { [key: string]: string } = {
      happy: '幸せ', sad: '悲しみ', angry: '怒り', calm: '穏やか',
      neutral: '中立', excited: '興奮', relaxed: 'リラックス',
      stressed: 'ストレス', tired: '疲労'
    };
    return labelMap[emotion] || emotion;
  };

  const dominantEmotion = emotionDistribution && Object.keys(emotionDistribution).length > 0
    ? Object.entries(emotionDistribution).sort((a, b) => b[1] - a[1])[0]?.[0]
    : 'neutral';

  const ProgressBar = ({ label, value, max = 5 }: { label: string; value: number; max?: number }) => {
    const percentage = (value / max) * 100;
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono">{value.toFixed(2)}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">😊 感情サマリー</h3>

      {/* AI感情要約 */}
      {aiInsights && (
        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {aiInsights}
          </p>
        </div>
      )}

      {/* 感情分布 */}
      {emotionDistribution && Object.keys(emotionDistribution).length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-semibold mb-3">感情の分布</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(emotionDistribution)
              .sort((a, b) => b[1] - a[1])
              .map(([emotion, count]) => (
                <div key={emotion} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                  <span className="flex items-center gap-2">
                    <span>{getEmotionEmoji(emotion)}</span>
                    <span className="text-xs">{getEmotionLabel(emotion)}</span>
                  </span>
                  <span className="font-mono text-xs font-semibold">{count}回</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* VAD値 */}
      <div className="space-y-3 mb-6">
        <p className="text-sm font-semibold">感情の詳細分析</p>
        <ProgressBar label="覚醒度" value={avgArousal} />
        <ProgressBar label="快度" value={avgValence} />
        <ProgressBar label="優位性" value={avgDominance} />
      </div>

      {/* 統計 */}
      <div className="text-xs text-muted-foreground pt-4 border-t">
        <div className="flex justify-between">
          <span>録音回数:</span>
          <span className="font-mono">{totalRecordings}回</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>総時間:</span>
          <span className="font-mono">{Math.floor(totalDuration / 60)}分{totalDuration % 60}秒</span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// DiaryTextCard Component
// ============================================================

interface DiaryTextCardProps {
  // transcription_textは使用しない - formatted_textのみを日記の要約として表示
  formattedText?: string;
}

export function DiaryTextCard({ formattedText }: DiaryTextCardProps) {
  // formatted_textを日記の要約として表示
  // AI要約前には要約が生成されていないことを確認
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">📝 今日の日記</h3>
      <div className="p-4 rounded-xl bg-muted inner-soft">
        <p className="whitespace-pre-wrap leading-relaxed text-sm">
          {formattedText || '日記がありません'}
        </p>
      </div>
    </Card>
  );
}

// ============================================================
// DialogueHistoryCard Component
// ============================================================

interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  input_type: string | null;
  voice_recordings?: Array<{
    emotion_analysis_results: Array<{
      segments: any[];
      total_segments: number;
      avg_arousal: number;
      avg_valence: number;
      avg_dominance: number;
    }>;
  }>;
}

interface DialogueHistoryCardProps {
  turns: DialogueTurn[];
}

export function DialogueHistoryCard({ turns }: DialogueHistoryCardProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMessages(newExpanded);
  };

  const vadToEmotion = (arousal: number, valence: number, dominance: number): string => {
    const arousalMid = 4.0;
    const valenceMid = 4.0;
    const arousalHigh = arousal > arousalMid;
    const valencHigh = valence > valenceMid;
    const arousalVeryHigh = arousal > 4.3;
    const arousalVeryLow = arousal < 3.7;
    const valenceVeryHigh = valence > 4.3;
    const valenceVeryLow = valence < 3.8;

    if (arousalVeryHigh && valenceVeryHigh) return '🤩 興奮';
    if (arousalHigh && valencHigh) return '😊 幸せ';
    if (arousalVeryHigh && valenceVeryLow) return '😠 怒り';
    if (arousalHigh && !valencHigh) return '😰 ストレス';
    if (arousalVeryLow && valencHigh) return '😌 穏やか';
    if (!arousalHigh && valenceVeryHigh) return '😎 リラックス';
    if (arousalVeryLow && valenceVeryLow) return '😢 悲しみ';
    if (!arousalHigh && valenceVeryLow) return '😴 疲労';
    if (valencHigh) return '😊 幸せ';
    if (valenceVeryLow) return '😢 悲しみ';
    return '😐 中立';
  };

  if (turns.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">💬 AIとの対話</h3>
        <p className="text-sm text-muted-foreground text-center py-4">
          この日はAIとの対話がありません
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">💬 AIとの対話</h3>

      <div className="space-y-3">
        {turns.map((turn, i) => {
          const emotionData = turn.voice_recordings?.[0]?.emotion_analysis_results?.[0];
          const isExpanded = expandedMessages.has(i);

          return (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  turn.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs opacity-70">
                    {new Date(turn.created_at).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* 感情データがある場合は詳細表示ボタン */}
                {turn.role === 'user' && emotionData && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <button
                      onClick={() => toggleExpand(i)}
                      className="flex items-center gap-2 text-xs opacity-90 hover:opacity-100 transition-opacity w-full"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          <span>詳細を閉じる</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          <span>感情分析を見る</span>
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="p-3 rounded-lg bg-black/10 dark:bg-white/10">
                          <p className="font-semibold mb-2">
                            {vadToEmotion(
                              emotionData.avg_arousal,
                              emotionData.avg_valence,
                              emotionData.avg_dominance
                            )}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="opacity-70">覚醒度:</span>
                              <p className="font-mono">{emotionData.avg_arousal.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="opacity-70">快度:</span>
                              <p className="font-mono">{emotionData.avg_valence.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="opacity-70">優位性:</span>
                              <p className="font-mono">{emotionData.avg_dominance.toFixed(2)}</p>
                            </div>
                          </div>
                          <p className="mt-2 opacity-70">
                            {emotionData.total_segments}個の発話区間を検出
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================================
// AIInsightsCard Component
// ============================================================

interface AIInsightsCardProps {
  insights: string | null;
}

export function AIInsightsCard({ insights }: AIInsightsCardProps) {
  return (
    <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
      <h3 className="font-semibold text-lg mb-4">💡 AIからの気づき</h3>
      <p className="text-sm leading-relaxed">
        {insights || '対話完了後にAIが気づきを生成します'}
      </p>
    </Card>
  );
}
