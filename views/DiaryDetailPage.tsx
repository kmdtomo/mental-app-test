'use client';

import { UserHeader } from '@/features/voice-diary/components/UserHeader';
import {
  EmotionSummaryCard,
  DiaryTextCard,
  DialogueHistoryCard,
  AIInsightsCard
} from '@/features/diary-detail/components';
import { ArrowLeft, Calendar } from 'lucide-react';
import Link from 'next/link';

interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  input_type: string | null;
}

interface DiaryDetailPageProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
  date: string;
  summary: {
    transcription_text: string | null;
    formatted_text: string | null;
    avg_arousal: number;
    avg_valence: number;
    avg_dominance: number;
    emotion_distribution: { [key: string]: number };
    total_recordings: number;
    total_duration_seconds: number;
    ai_insights: string | null;
  } | null;
  dialogueTurns: DialogueTurn[];
}

export function DiaryDetailPage({ user, date, summary, dialogueTurns }: DiaryDetailPageProps) {
  if (!summary) {
    return (
      <div className="min-h-screen panel">
        <UserHeader user={user} />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-muted-foreground">この日の日記はありません</p>
            <Link href="/dashboard">
              <button className="mt-4 text-primary hover:underline">
                ダッシュボードに戻る
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div className="min-h-screen panel">
      <UserHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* ページヘッダー */}
          <div>
            <Link href="/dashboard">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" />
                ダッシュボードに戻る
              </button>
            </Link>

            <div className="glass soft-shadow rounded-[24px] p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">{formatDate(date)}の振り返り</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {summary.total_recordings}件の録音 • {Math.floor(summary.total_duration_seconds / 60)}分
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 感情サマリー */}
          <EmotionSummaryCard
            avgArousal={summary.avg_arousal}
            avgValence={summary.avg_valence}
            avgDominance={summary.avg_dominance}
            emotionDistribution={summary.emotion_distribution}
            totalRecordings={summary.total_recordings}
            totalDuration={summary.total_duration_seconds}
          />

          {/* 日記テキスト */}
          <DiaryTextCard
            transcriptionText={summary.transcription_text || ''}
            formattedText={summary.formatted_text || undefined}
          />

          {/* AI対話履歴 */}
          <DialogueHistoryCard turns={dialogueTurns} />

          {/* AIからの気づき */}
          <AIInsightsCard insights={summary.ai_insights} />
        </div>
      </div>
    </div>
  );
}
