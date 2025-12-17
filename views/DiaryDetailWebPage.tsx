'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { ChevronLeft, ChevronRight, BookOpen, Sparkles, Activity, ChevronDown, ChevronUp, User, Pencil, Check, X } from 'lucide-react';
import { EmotionChart, SummaryRadar } from '@/features/diary-detail-web/components';
import { DailySummary } from '@/lib/db/dailySummary';
import { getEmotionHexColorForUI } from '@/lib/emotionLabeling';

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

// 感情に応じた色付きテキストを表示するコンポーネント
function ColoredTranscript({ segments }: { segments: TranscriptionSegment[] }) {
  return (
    <p className="text-lg text-[#3D3632]">
      {segments.map((segment, index) => {
        // UI用の色取得（中立はtransparent）
        const emotionColor = getEmotionHexColorForUI(segment.emotion_label || '中立');
        // 中立（transparent）の場合はスタイルなし
        const isNeutral = emotionColor === 'transparent';
        return (
          <span
            key={segment.id || index}
            style={isNeutral ? {} : {
              backgroundColor: `${emotionColor}20`,
              borderBottom: `2px solid ${emotionColor}`,
              paddingBottom: '2px',
            }}
            title={segment.emotion_label || '中立'}
          >
            {segment.text}
          </span>
        );
      })}
    </p>
  );
}

// 感情グラフ表示トグルコンポーネント
function EmotionChartToggle({ segments }: { segments: TranscriptionSegment[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // セグメントをEmotionChart用のデータに変換
  const emotionData: EmotionPoint[] = segments
    .filter(s => s.arousal !== null && s.valence !== null)
    .map((segment, index) => ({
      id: segment.id || `seg-${index}`,
      timestamp: Date.now() - (segments.length - index) * 5000, // 相対的な時間（表示には影響しない）
      formattedTime: `0:${String(index * 5).padStart(2, '0')}`,
      arousal: segment.arousal || 4,
      valence: segment.valence || 4,
      dominance: segment.dominance ?? undefined,
      speaker: 'user' as const,
      text: segment.text,
      emotionLabel: segment.emotion_label || '中立',
    }));

  if (emotionData.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FBF7F3] hover:bg-[#F5EBE0] transition-colors border border-[#F5EBE0]"
      >
        <Activity className="w-3.5 h-3.5 text-[#C17B68]" />
        <span className="text-[11px] font-semibold text-[#C17B68]">感情の推移</span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-[#C17B68]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#C17B68]" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 p-4 rounded-[16px] bg-white shadow-[0_2px_8px_rgba(193,123,104,0.1)] border border-[#F5EBE0] min-w-[300px]">
          <div className="h-[140px] w-full">
            <EmotionChart data={emotionData} compact />
          </div>
        </div>
      )}
    </div>
  );
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

  // 日記編集用の状態
  const [isEditingDiary, setIsEditingDiary] = useState(false);
  const [editedDiaryText, setEditedDiaryText] = useState(summary?.formatted_text || summary?.transcription_text || '');
  const [isSaving, setIsSaving] = useState(false);

  // 日記を保存
  const saveDiary = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/update-diary-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date, formattedText: editedDiaryText }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      setIsEditingDiary(false);
      // ページをリフレッシュして最新データを取得
      router.refresh();
    } catch (error) {
      console.error('Error saving diary:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 編集をキャンセル
  const cancelEdit = () => {
    setEditedDiaryText(summary?.formatted_text || summary?.transcription_text || '');
    setIsEditingDiary(false);
  };

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


  // 前後の日付へナビゲート
  const navigateToDate = (targetDate: string | null) => {
    if (targetDate) {
      router.push(`/diary-detail-web?date=${targetDate}`);
    }
  };

  // データがない場合の表示
  const hasData = dialogueTurns.length > 0 || summary !== null;

  return (
    <div className="flex w-full h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
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

              {/* Main Content Section - 日記の要約とAIメッセージ - 左2カラム */}
              <div className="md:col-span-2 flex flex-col gap-6">
                {/* Diary Summary */}
                <div className="bg-[#FAF5F0] rounded-[32px] p-8 border border-[#C17B68]/10 shadow-[0_4px_15px_rgba(193,123,104,0.05)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#C17B68]/10 flex items-center justify-center text-[#C17B68]">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-[#3D3632]">日記の要約</h3>
                    </div>
                    {/* 編集ボタン */}
                    {!isEditingDiary ? (
                      <button
                        onClick={() => setIsEditingDiary(true)}
                        className="p-2 rounded-full hover:bg-[#C17B68]/10 transition-colors"
                        title="編集"
                      >
                        <Pencil className="w-5 h-5 text-[#C17B68]" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelEdit}
                          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                          title="キャンセル"
                          disabled={isSaving}
                        >
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                        <button
                          onClick={saveDiary}
                          className="p-2 rounded-full hover:bg-green-100 transition-colors"
                          title="保存"
                          disabled={isSaving}
                        >
                          <Check className="w-5 h-5 text-green-600" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditingDiary ? (
                    <textarea
                      value={editedDiaryText}
                      onChange={(e) => setEditedDiaryText(e.target.value)}
                      className="w-full min-h-[150px] p-4 rounded-xl border border-[#C17B68]/20 bg-white text-[#6B5F58] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#C17B68]/30 resize-y"
                      placeholder="日記を入力..."
                      disabled={isSaving}
                    />
                  ) : (
                    <p className="text-[#6B5F58] leading-relaxed whitespace-pre-wrap">
                      {summary?.formatted_text || summary?.transcription_text || 'この日の要約はまだ生成されていません。'}
                    </p>
                  )}
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

              {/* Assessment Radar Section - 右1カラム */}
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


              </div>

              {/* Transcript Log - Updated to match AIDialogueWebPage UI */}
              <div className="md:col-span-3 flex flex-col p-6 rounded-[20px] bg-white text-[#3D3632] shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)] min-h-0 relative h-[600px] border border-[#F5EBE0]">
                <h2 className="text-2xl mb-6 font-semibold text-[#3D3332]">対話履歴</h2>
                <div className="overflow-y-auto flex-1 min-h-0 pr-4">
                  {dialogueTurns.length > 0 ? (
                    dialogueTurns.map((turn, index) => {
                      // 録音IDに関連するセグメントを取得
                      const segments = turn.role === 'user' && turn.recording_id
                        ? transcriptionSegments
                          .filter(s => s.recording_id === turn.recording_id)
                          .sort((a, b) => a.segment_index - b.segment_index)
                        : [];

                      return (
                        <div key={index} className={`flex w-full ${turn.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
                          <div className={`flex max-w-[90%] md:max-w-[85%] gap-3 ${turn.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Icon */}
                            <div className="flex-shrink-0 pt-1">
                              {turn.role === 'user' ? (
                                user.avatarUrl ? (
                                  <img src={user.avatarUrl} alt="User" className="w-9 h-9 rounded-full object-cover shadow-sm border border-white" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-[#C17B68] flex items-center justify-center shadow-sm text-white">
                                    <User size={18} />
                                  </div>
                                )
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C17B68] to-[#A66250] flex items-center justify-center shadow-sm text-white">
                                  <Sparkles size={18} />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex flex-col min-w-0">
                              <div className={`p-4 rounded-[16px] ${turn.role === 'user' ? 'rounded-tr-sm bg-white shadow-[0_2px_6px_rgba(193,123,104,0.12)] border border-[#F5EBE0]' : 'rounded-tl-sm bg-[#C17B68]/10'}`}>
                                {turn.role === 'user' && segments.length > 0 ? (
                                  <ColoredTranscript segments={segments} />
                                ) : (
                                  <p className="text-lg text-[#3D3632]">{turn.content}</p>
                                )}
                              </div>

                              {/* ユーザー発話の場合、感情グラフトグルを表示 */}
                              {turn.role === 'user' && segments.length > 0 && (
                                <EmotionChartToggle segments={segments} />
                              )}

                              <div className={`flex items-center gap-2 mt-1.5 px-1 ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-xs font-medium text-[#9A8D85]">{formatTime(turn.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
