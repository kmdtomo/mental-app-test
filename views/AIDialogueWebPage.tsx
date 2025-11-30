'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { Mic, FileText, Activity, ChevronDown, ChevronUp, Square, Loader2 } from 'lucide-react';
import { EmotionChart } from '@/features/diary-detail-web/components';
import { getTodayDialogue } from '@/features/diary-chat/actions/chatActions';
import { useVoiceRecorder } from '@/features/voice-diary/hooks/useVoiceRecorder';
import { useAudioVisualizer } from '@/features/voice-diary/hooks/useAudioVisualizer';

// 感情の色を定義（valenceベースのグラデーション、EmotionChartと統一）
// 高valence（ポジティブ）= 緑系、低valence（ネガティブ）= 赤/オレンジ系
const emotionColors: Record<string, string> = {
  '喜び・楽しい': '#10B981',       // 緑（最もポジティブ）
  '穏やか・リラックス': '#34D399', // 薄緑
  '落ち着き': '#5EEAD4',          // ティール
  '中立': '#C17B68',              // 茶色（中央）
  'ストレス・緊張': '#F59E0B',    // オレンジ
  '不安・心配': '#F97316',        // オレンジ赤
  '悲しみ': '#FB7185',            // ピンク赤
  '疲労・無気力': '#F43F5E',      // 赤（最もネガティブ）
};

// セグメントの型
interface Segment {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  emotion_label: string | null;
  arousal: number | null;
  valence: number | null;
  dominance: number | null;
}

// メッセージの型
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  segments?: Segment[];
  emotionData?: {
    segments: Segment[];
    total_segments: number;
    avg_arousal: number;
    avg_valence: number;
    avg_dominance: number;
  };
}

// EmotionChart用のデータ型
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

interface AIDialogueWebPageProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    createdAt?: string;
  };
  recordingLimit: {
    used: number;
    remaining: number;
    total: number;
  };
}

// 感情に応じた色付きテキストを表示するコンポーネント
function ColoredTranscript({ segments }: { segments: Segment[] }) {
  return (
    <p className="text-lg text-[#3D3632]">
      {segments.map((segment, index) => {
        const emotionColor = emotionColors[segment.emotion_label || '中立'] || '#9A8D85';
        return (
          <span
            key={segment.id || index}
            style={{
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
function EmotionChartToggle({ segments }: { segments: Segment[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // セグメントをEmotionChart用のデータに変換
  const emotionData: EmotionPoint[] = segments
    .filter(s => s.arousal !== null && s.valence !== null)
    .map((segment, index) => ({
      id: segment.id || `seg-${index}`,
      timestamp: Date.now() - (segments.length - index) * 5000,
      formattedTime: `0:${String(index * 5).padStart(2, '0')}`,
      arousal: segment.arousal || 4, // 生のVAD値を渡す（3.4-4.6の範囲）
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
        <div className="mt-2 p-4 rounded-[16px] bg-white shadow-[0_2px_8px_rgba(193,123,104,0.1)] border border-[#F5EBE0]">
          <div className="h-[140px] w-full">
            <EmotionChart data={emotionData} compact />
          </div>
        </div>
      )}
    </div>
  );
}

export function AIDialogueWebPage({ user, recordingLimit: initialRecordingLimit }: AIDialogueWebPageProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessingUser, setIsProcessingUser] = useState(false);  // ユーザー側の処理中（文字起こし・感情分析）
  const [userLoadingMessage, setUserLoadingMessage] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);      // AI側の処理中（応答生成）
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [recordingLimit, setRecordingLimit] = useState(initialRecordingLimit);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingDurationRef = useRef(0);

  // 録音フック
  const {
    isRecording,
    isStarting,
    duration,
    formattedDuration,
    error,
    stream,
    startRecording,
    stopRecording
  } = useVoiceRecorder({
    maxDuration: 60000,
    onRecordingComplete: async (blob) => {
      setIsProcessing(true);
      try {
        await handleRecordingComplete(blob, Math.ceil(recordingDurationRef.current / 1000));
      } finally {
        setIsProcessing(false);
      }
    }
  });

  const canvasRef = useAudioVisualizer(stream);

  // 録音時間を追跡
  if (isRecording) {
    recordingDurationRef.current = duration;
  }

  // 初回ロード時に今日の対話履歴を取得
  useEffect(() => {
    loadTodayDialogue();
  }, []);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessingUser, isProcessingAI]);

  const loadTodayDialogue = async () => {
    const result = await getTodayDialogue();
    if (result.success && result.messages) {
      setMessages(result.messages as Message[]);
    }
  };

  const handleRecordingComplete = async (blob: Blob, durationSec: number) => {
    console.log('=== Chat Recording Complete ===');

    setUserLoadingMessage('文字起こし中...');
    setIsProcessingUser(true);

    try {
      // 1. Upload to Supabase
      const { uploadAudio } = await import('@/features/voice-diary/actions/uploadAudio');
      const uploadResult = await uploadAudio(blob);

      // 2. Call Whisper Segmented API
      const whisperResponse = await fetch('/api/whisper-segmented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recordingId: uploadResult.recordingId,
          filePath: uploadResult.filePath,
        }),
      });

      if (!whisperResponse.ok) {
        throw new Error('Whisper Segmented API failed');
      }

      const whisperData = await whisperResponse.json();

      // 3. Call Emotion Analysis Segmented API
      setUserLoadingMessage('感情分析中...');
      const emotionResponse = await fetch('/api/analyze-emotion-segmented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recordingId: uploadResult.recordingId,
          filePath: uploadResult.filePath,
        }),
      });

      // 4. 感情分析結果を取得（APIレスポンスを直接使用）
      let transcriptionSegments: Segment[] | null = null;
      let avgArousal = 0;
      let avgValence = 0;
      let avgDominance = 0;

      if (!emotionResponse.ok) {
        console.warn('Emotion analysis failed, continuing without emotion data');
      } else {
        // 感情分析APIのレスポンスを直接使用（DBを再クエリしない）
        const emotionData = await emotionResponse.json();

        if (emotionData.success && emotionData.segments && emotionData.segments.length > 0) {
          // APIレスポンスのセグメントをSegment型にマッピング
          transcriptionSegments = emotionData.segments.map((seg: any) => ({
            id: seg.id,
            text: seg.text,
            start_time: seg.start_time,
            end_time: seg.end_time,
            emotion_label: seg.emotion_label,
            arousal: seg.arousal,
            valence: seg.valence,
            dominance: seg.dominance,
          }));

          // 平均VAD値を計算
          const validSegments = transcriptionSegments!.filter(
            s => s.arousal !== null && s.valence !== null && s.dominance !== null
          );

          if (validSegments.length > 0) {
            avgArousal = validSegments.reduce((sum, s) => sum + s.arousal!, 0) / validSegments.length;
            avgValence = validSegments.reduce((sum, s) => sum + s.valence!, 0) / validSegments.length;
            avgDominance = validSegments.reduce((sum, s) => sum + s.dominance!, 0) / validSegments.length;
          }
        }
      }

      // 5. ユーザーメッセージをUIに追加
      const userMessage: Message = {
        role: 'user',
        content: whisperData.text,
        timestamp: new Date().toISOString(),
        segments: transcriptionSegments || undefined,
        emotionData: transcriptionSegments && transcriptionSegments.length > 0 ? {
          segments: transcriptionSegments,
          total_segments: transcriptionSegments.length,
          avg_arousal: avgArousal,
          avg_valence: avgValence,
          avg_dominance: avgDominance
        } : undefined
      };

      setMessages(prev => [...prev, userMessage]);

      // ユーザー側のローディング終了、AI側のローディング開始
      setIsProcessingUser(false);
      setIsProcessingAI(true);

      const aiResponse = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userMessage: whisperData.text,
          recordingId: uploadResult.recordingId,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error('AI Chat API failed');
      }

      const aiData = await aiResponse.json();

      // 7. AI応答をチャットに追加
      const aiMessage: Message = {
        role: 'assistant',
        content: aiData.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsProcessingAI(false);

      // 8. 録音回数を更新
      setRecordingLimit(prev => ({
        ...prev,
        used: prev.used + 1,
        remaining: Math.max(0, prev.remaining - 1)
      }));

    } catch (error) {
      console.error('Error processing recording:', error);
      setIsProcessingUser(false);
      setIsProcessingAI(false);
    }
  };

  const generateSummaryAndRedirect = async () => {
    setIsGeneratingSummary(true);

    try {
      const date = new Date().toISOString().split('T')[0];

      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date }),
      });

      if (!response.ok) {
        throw new Error('Summary generation failed');
      }

      // 日記詳細ページに遷移
      router.push(`/diary-detail-web?date=${date}`);

    } catch (error) {
      console.error('Error generating summary:', error);
      setIsGeneratingSummary(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="dialogue" user={user} />

      {/* Main Content */}
      <main className="overflow-x-hidden flex bg-[#FBF7F3] h-full flex-1">
        {/* Chat History Column - flex-1でスペースを埋め、min-w-0でshrink可能に */}
        <div className="flex flex-col flex-1 min-w-0 py-8 pl-8 pr-4 h-full">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl mb-2 font-semibold text-[#3D3632]">AIとの対話</h1>
            <p className="text-lg text-[#6B5F58]">音声でAIと対話し、あなたの気持ちを記録します</p>
          </div>

          <div className="flex flex-col grow shrink p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)] min-h-0">
            <h2 className="text-2xl mb-6 font-semibold text-[#3D3332]">対話履歴</h2>
            <div className="overflow-y-auto flex-1 min-h-0 pr-4">
              {messages.length === 0 && !isProcessingUser && !isProcessingAI && (
                <div className="text-center text-[#6B5F58] py-8">
                  <p className="text-lg">録音ボタンを押して、今日の気持ちを話してみましょう</p>
                  <p className="text-base mt-2">AIがあなたの本音を引き出すお手伝いをします</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
                  <div className={message.role === 'user' ? 'max-w-[85%]' : 'max-w-[80%]'}>
                    <div className={`p-4 rounded-[16px] ${message.role === 'user' ? 'rounded-br-[4px] bg-white shadow-[0_2px_6px_rgba(193,123,104,0.12)]' : 'rounded-bl-[4px] bg-[#C17B68]/15'}`}>
                      {message.role === 'user' && message.segments && message.segments.length > 0 ? (
                        <ColoredTranscript segments={message.segments} />
                      ) : (
                        <p className="text-lg text-[#3D3632]">{message.content}</p>
                      )}
                    </div>

                    {/* ユーザー発話の場合、感情グラフトグルを表示 */}
                    {message.role === 'user' && message.segments && message.segments.length > 0 && (
                      <EmotionChartToggle segments={message.segments} />
                    )}

                    <div className={`flex items-center gap-2 mt-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-base text-[#9A8D85]">{formatTime(message.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* ユーザー側ローディング（文字起こし・感情分析中）- 右側 */}
              {isProcessingUser && (
                <div className="flex justify-end mb-6">
                  <div className="max-w-[85%]">
                    <div className="p-4 rounded-[16px] rounded-br-[4px] bg-white shadow-[0_2px_6px_rgba(193,123,104,0.12)]">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-[#C17B68] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[#C17B68] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[#C17B68] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-base text-[#6B5F58]">{userLoadingMessage}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI側ローディング（応答生成中）- 左側 */}
              {isProcessingAI && (
                <div className="flex justify-start mb-6">
                  <div className="max-w-[80%]">
                    <div className="p-4 rounded-[16px] rounded-bl-[4px] bg-[#C17B68]/15">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-[#C17B68] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[#C17B68] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[#C17B68] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-base text-[#6B5F58]">AIが考えています...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Voice Recording Panel */}
        <div className="flex flex-col w-96 py-8 pl-4 pr-8 h-full">
          {/* Spacer to align with left column header */}
          <div className="mb-8">
            <div className="h-[4.5rem]"></div>
          </div>
          <div className="flex flex-col items-center p-8 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)]">
            <h2 className="text-2xl mb-8 font-semibold text-[#3D3632]">音声録音</h2>

            {/* Recording Button */}
            <div className="mb-8">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isProcessing || recordingLimit.remaining <= 0}
                  className="flex justify-center items-center w-32 h-32 rounded-full bg-[#C17B68] shadow-[0_4px_16px_rgba(193,123,104,0.3)] hover:shadow-[0_8px_24px_rgba(193,123,104,0.4)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <Loader2 className="text-4xl text-white/85 animate-spin" size={48} />
                  ) : (
                    <Mic className="text-4xl text-white/85" size={48} />
                  )}
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex justify-center items-center w-32 h-32 rounded-full bg-red-500 shadow-[0_4px_16px_rgba(239,68,68,0.3)] hover:shadow-[0_8px_24px_rgba(239,68,68,0.4)] transition-shadow animate-pulse"
                >
                  <Square className="text-4xl text-white/85" size={48} />
                </button>
              )}
            </div>

            {/* Timer */}
            <div className="mb-8">
              <div className="text-3xl text-center font-semibold text-[#C17B68]">
                {isRecording || isStarting ? formattedDuration : '00:00'}
              </div>
              <div className="text-base text-center mt-1 text-[#6B5F58]">
                {isRecording ? '録音中...' : isProcessing ? '処理中...' : '録音時間'}
              </div>
            </div>

            {/* Waveform Visualization */}
            <div className="mb-8 w-full">
              {(isRecording || isStarting) ? (
                <div className="h-16 rounded-xl bg-[#C17B68]/10 overflow-hidden">
                  <canvas ref={canvasRef} width={300} height={64} className="w-full h-full" />
                </div>
              ) : (
                <div className="flex justify-center items-center gap-1 h-16">
                  <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
                  <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
                  <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
                  <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
                  <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
                </div>
              )}
            </div>

            {/* Recording Count */}
            <div className="text-center w-full p-4 rounded-[12px] bg-[#A8B89F]/10">
              <div className="text-lg font-semibold text-[#3D3632]">残り録音回数</div>
              <div className="flex justify-center items-center gap-2 mt-2">
                <span className="text-2xl font-semibold text-[#C17B68]">{recordingLimit.remaining}</span>
                <span className="text-lg text-[#6B5F58]">/ {recordingLimit.total}回</span>
              </div>
              <div className="mt-3">
                <div className="h-2 rounded-full bg-[#A8B89F]/20">
                  <div
                    className="h-full rounded-full bg-[#A8B89F]"
                    style={{ width: `${(recordingLimit.used / recordingLimit.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-500 text-center">{error}</div>
            )}
          </div>

          {/* Generate Diary Button */}
          <div className="mt-2">
            <button
              onClick={generateSummaryAndRedirect}
              disabled={isGeneratingSummary || messages.filter(m => m.role === 'user').length < 2}
              className="flex justify-center items-center gap-3 w-full py-4 px-6 rounded-full bg-[#4A7C59] text-white shadow-[0_2px_8px_rgba(74,124,89,0.3)] hover:bg-[#3D6B4A] hover:shadow-[0_4px_12px_rgba(74,124,89,0.4)] transition-all disabled:bg-[#D4DED0] disabled:text-white/60 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <FileText className="text-lg" size={18} />
              <span className="text-lg whitespace-nowrap font-semibold">
                {isGeneratingSummary ? '生成中...' : '日記を生成'}
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
