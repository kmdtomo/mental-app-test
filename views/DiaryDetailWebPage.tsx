'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { ChevronLeft, ChevronRight, Activity, BookOpen, Sparkles, MessageCircle } from 'lucide-react';
import { EmotionChart, SummaryRadar } from '@/features/diary-detail-web/components';
import { DailySummary } from '@/lib/db/dailySummary';

interface EmotionPoint {
  id: string;
  timestamp: number;
  formattedTime: string;
  arousal: number;
  valence: number;
  dominance?: number;
  speaker: 'user' | 'model';
  text: string;
  emotionLabel?: string;
}

interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  input_type: string | null;
  recording_id: string | null;
}

interface TranscriptionSegment {
  id: string;
  recording_id: string;
  segment_index: number;
  text: string;
  start_time: number;
  end_time: number;
  arousal: number | null;
  valence: number | null;
  dominance: number | null;
  emotion_label: string | null;
  created_at: string;
}

interface DiaryDetailWebPageProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  date: string;
  summary: DailySummary | null;
  dialogueTurns: DialogueTurn[];
  transcriptionSegments: TranscriptionSegment[];
  adjacentDates: {
    prev: string | null;
    next: string | null;
  };
}

export function DiaryDetailWebPage({
  user,
  date,
  summary,
  dialogueTurns,
  transcriptionSegments,
  adjacentDates
}: DiaryDetailWebPageProps) {
  const router = useRouter();

  // 日付をフォーマット
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // 時刻をフォーマット (HH:MM)
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // dialogue_turnsとtranscription_segmentsからEmotionChart用のデータを生成
  // ユーザーの音声セグメントのみを時系列順にグラフ化（AIの応答は除外）
  const emotionData: EmotionPoint[] = useMemo(() => {
    const points: EmotionPoint[] = [];

    dialogueTurns.forEach((turn) => {
      const turnTimestamp = new Date(turn.created_at).getTime();

      // ユーザーの音声入力のみをグラフ化（AIの応答とテキスト入力は除外）
      if (turn.role === 'user' && turn.recording_id) {
        // transcription_segmentsから全セグメントを取得
        const segments = transcriptionSegments
          .filter(s => s.recording_id === turn.recording_id)
          .sort((a, b) => a.segment_index - b.segment_index); // segment_index順でソート

        segments.forEach((segment) => {
          // 同一録音内のセグメントはstart_timeを使って相対的な時系列を作成
          // turnのタイムスタンプ + start_time（秒→ミリ秒）で正確な順序を保持
          // start_timeがnullの場合はsegment_index * 3秒として仮定
          const startTimeMs = (segment.start_time ?? segment.segment_index * 3) * 1000;
          const segmentTimestamp = turnTimestamp + startTimeMs;

          // 表示用の時刻は、録音開始時刻 + start_time（秒）を加算して計算
          const segmentDate = new Date(turnTimestamp + startTimeMs);
          const segmentFormattedTime = `${segmentDate.getHours().toString().padStart(2, '0')}:${segmentDate.getMinutes().toString().padStart(2, '0')}:${segmentDate.getSeconds().toString().padStart(2, '0')}`;

          points.push({
            id: segment.id,
            timestamp: segmentTimestamp,
            formattedTime: segmentFormattedTime, // 秒単位で表示
            arousal: segment.arousal ?? 0.5,
            valence: segment.valence ?? 0.5,
            dominance: segment.dominance ?? undefined,
            speaker: 'user',
            text: segment.text,
            emotionLabel: segment.emotion_label || undefined
          });
        });
      }
      // AIの応答とテキスト入力はグラフには含めない
    });

    return points.sort((a, b) => a.timestamp - b.timestamp);
  }, [dialogueTurns, transcriptionSegments]);

  // 感情トレンドを計算
  const emotionTrend = useMemo(() => {
    if (emotionData.length < 2) return 'データ不足';
    const userPoints = emotionData.filter(p => p.speaker === 'user');
    if (userPoints.length < 2) return 'データ不足';

    const diff = userPoints[userPoints.length - 1].valence - userPoints[0].valence;
    if (diff > 0.1) return '↗ 改善傾向';
    if (diff < -0.1) return '↘ 悩みあり';
    return '→ 安定';
  }, [emotionData]);

  // 前後の日付へナビゲート
  const navigateToDate = (targetDate: string | null) => {
    if (targetDate) {
      router.push(`/diary-detail-web?date=${targetDate}`);
    }
  };

  // データがない場合の表示
  const hasData = dialogueTurns.length > 0 || summary !== null;

  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="dashboard" user={user} />

      {/* Main Content */}
      <main className="overflow-x-hidden overflow-y-auto grow shrink bg-[#FBF7F3] h-full">
        <div className="py-8 px-12">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-4xl font-semibold text-[#3D3632]">日記詳細</h1>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateToDate(adjacentDates.prev)}
                  disabled={!adjacentDates.prev}
                  className={`flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)] transition-shadow ${!adjacentDates.prev ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <ChevronLeft className="text-lg text-[#6B5F58]" />
                </button>
                <span className="text-xl text-center min-w-[180px] font-semibold text-[#3D3632]">{formatDate(date)}</span>
                <button
                  onClick={() => navigateToDate(adjacentDates.next)}
                  disabled={!adjacentDates.next}
                  className={`flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)] transition-shadow ${!adjacentDates.next ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <ChevronRight className="text-lg text-[#6B5F58]" />
                </button>
              </div>
            </div>
            <p className="text-lg text-[#6B5F58]">今日の心の状態を振り返りましょう</p>
          </div>

          {!hasData ? (
            // データがない場合
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-[#C17B68]/10 flex items-center justify-center mb-6">
                <BookOpen className="w-10 h-10 text-[#C17B68]" />
              </div>
              <h2 className="text-2xl font-semibold text-[#3D3632] mb-2">この日の記録はありません</h2>
              <p className="text-lg text-[#6B5F58] mb-6">別の日付を選択するか、新しい日記を記録してください</p>
              <button
                onClick={() => router.push('/dashboard-web')}
                className="px-6 py-3 rounded-full bg-[#C17B68] text-white font-semibold hover:bg-[#A66250] transition-colors"
              >
                ダッシュボードに戻る
              </button>
            </div>
          ) : (
            /* Grid Layout */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Main Chart Section - Spans 2 columns */}
              <div className="md:col-span-2 bg-white rounded-[32px] shadow-[0_4px_20px_rgba(193,123,104,0.08)] p-6 min-h-[400px] flex flex-col relative overflow-visible border border-[#F5EBE0]">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-[#C17B68] font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" /> 感情の推移 (Emotional Flow)
                  </h3>
                  <div className="text-xs font-bold text-[#6B5F58] px-3 py-1 bg-[#FBF7F3] rounded-full">
                    感情分析
                  </div>
                </div>
                <div className="flex-1 w-full h-full -ml-2">
                  {emotionData.length > 0 ? (
                    <EmotionChart data={emotionData} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[#6B5F58]">
                      感情データがありません
                    </div>
                  )}
                </div>
              </div>

              {/* Assessment Radar Section - Spans 1 column */}
              <div className="md:col-span-1 flex flex-col gap-6">
                {/* Radar Card */}
                <div className="bg-white rounded-[32px] shadow-[0_4px_20px_rgba(193,123,104,0.08)] p-6 flex-1 min-h-[300px] flex flex-col border border-[#F5EBE0]">
                  <h3 className="text-[#C17B68] font-bold uppercase tracking-wider text-sm mb-4 text-center">
                    会話バランス
                  </h3>
                  <div className="flex-1 w-full">
                    {emotionData.length > 0 ? (
                      <SummaryRadar data={emotionData} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-[#6B5F58]">
                        データがありません
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats Card */}
                <div className="bg-[#C17B68] rounded-[24px] shadow-[0_4px_15px_rgba(193,123,104,0.2)] p-6 text-white flex flex-col justify-center gap-2">
                  <span className="text-white/80 text-xs font-bold uppercase tracking-widest">感情トレンド</span>
                  <div className="text-2xl font-bold">
                    {emotionTrend}
                  </div>
                  <p className="text-white/70 text-sm leading-snug mt-1">
                    {summary?.total_recordings || dialogueTurns.filter(t => t.role === 'user').length} 回の対話から分析
                  </p>
                </div>
              </div>

              {/* Diary Summary & AI Advice */}
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Diary Summary */}
                <div className="bg-[#FAF5F0] rounded-[32px] p-8 border border-[#C17B68]/10 shadow-[0_4px_15px_rgba(193,123,104,0.05)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#C17B68]/10 flex items-center justify-center text-[#C17B68]">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-[#3D3632]">日記の要約</h3>
                  </div>
                  <p className="text-[#6B5F58] leading-relaxed whitespace-pre-wrap">
                    {summary?.formatted_text || summary?.transcription_text || 'この日の要約はまだ生成されていません。'}
                  </p>
                </div>

                {/* AI Advice */}
                <div className="bg-gradient-to-br from-[#C17B68] to-[#A66250] rounded-[32px] p-8 text-white shadow-[0_8px_25px_rgba(193,123,104,0.25)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold">AIからのメッセージ</h3>
                  </div>
                  <p className="text-white/90 leading-relaxed relative z-10 font-medium text-lg">
                    {summary?.ai_insights || 'AIからのメッセージはまだ生成されていません。'}
                  </p>
                </div>
              </div>

              {/* Transcript Log */}
              <div className="md:col-span-3 bg-white rounded-[32px] shadow-[0_4px_20px_rgba(193,123,104,0.08)] p-8 border border-[#F5EBE0]">
                <h3 className="text-[#6B5F58] font-bold text-lg mb-6 border-b border-[#F5EBE0] pb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" /> 会話ログ
                </h3>
                <div className="space-y-6 max-h-[300px] overflow-y-auto pr-4">
                  {dialogueTurns.length > 0 ? (
                    dialogueTurns.map((turn, index) => (
                      <div key={index} className="flex gap-4 group">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full mt-2 transition-transform group-hover:scale-125 ${turn.role === 'user' ? 'bg-[#C17B68]' : 'bg-[#6B5F58]'}`}></div>
                          <div className="w-px h-full bg-[#F5EBE0] my-1 group-last:hidden"></div>
                        </div>
                        <div className="pb-4 flex-1">
                          <div className="flex items-baseline gap-3 mb-1">
                            <span className={`text-sm font-bold ${turn.role === 'user' ? 'text-[#C17B68]' : 'text-[#6B5F58]'}`}>
                              {turn.role === 'user' ? 'あなた' : 'AIパートナー'}
                            </span>
                            <span className="text-xs text-[#C17B68]/50 font-mono">{formatTime(turn.created_at)}</span>
                          </div>
                          <p className="text-[#3D3632] text-base leading-relaxed bg-[#FBF7F3] p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl inline-block max-w-full">
                            {turn.content}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[#6B5F58] text-center py-8">この日の会話ログはありません</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
