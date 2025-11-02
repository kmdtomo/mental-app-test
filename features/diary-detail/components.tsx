'use client';

import { Card } from '@/components/ui/Card';

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
}

export function EmotionSummaryCard({
  avgArousal,
  avgValence,
  avgDominance,
  emotionDistribution,
  totalRecordings,
  totalDuration
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

  const dominantEmotion = Object.entries(emotionDistribution)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

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

      {/* 主要な感情 */}
      <div className="text-center mb-6 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
        <span className="text-4xl">{getEmotionEmoji(dominantEmotion)}</span>
        <p className="text-lg font-semibold mt-2">{getEmotionLabel(dominantEmotion)}</p>
        <p className="text-xs text-muted-foreground mt-1">主な感情</p>
      </div>

      {/* 感情分布 */}
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
  transcriptionText: string;
  formattedText?: string;
}

export function DiaryTextCard({ transcriptionText, formattedText }: DiaryTextCardProps) {
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">📝 今日の日記</h3>
      <div className="p-4 rounded-xl bg-muted inner-soft">
        <p className="whitespace-pre-wrap leading-relaxed text-sm">
          {formattedText || transcriptionText || '日記がありません'}
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
}

interface DialogueHistoryCardProps {
  turns: DialogueTurn[];
}

export function DialogueHistoryCard({ turns }: DialogueHistoryCardProps) {
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
        {turns.map((turn, i) => (
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
            </div>
          </div>
        ))}
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
