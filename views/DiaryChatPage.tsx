'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface, ChatMessage } from '@/features/diary-chat/components';
import { UserHeader } from '@/features/voice-diary/components/UserHeader';
import { VoiceRecorder } from '@/features/voice-diary/components/VoiceRecorder';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { MessageCircle, ArrowLeft, FileText, FlaskConical, FileAudio } from 'lucide-react';
import Link from 'next/link';
import { getTodayDialogue } from '@/features/diary-chat/actions/chatActions';

type ExperimentGroup = 'intervention' | 'baseline';

// セグメントの型（Supabaseから取得）
interface TranscriptionSegmentData {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  emotion_label: string | null;
  arousal: number | null;
  valence: number | null;
  dominance: number | null;
}

interface DiaryChatPageProps {
  user?: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
  recordingLimit?: {
    used: number;
    remaining: number;
    total: number;
  };
}

export function DiaryChatPage({ user, recordingLimit }: DiaryChatPageProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('処理中...');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [experimentGroup, setExperimentGroup] = useState<ExperimentGroup>('intervention');

  // 初回ロード時に今日の対話履歴を取得
  useEffect(() => {
    loadTodayDialogue();
  }, []);

  const loadTodayDialogue = async () => {
    const result = await getTodayDialogue();

    if (result.success && result.messages) {
      setMessages(result.messages);
    }
  };

  // 介入群用: 感情分析あり
  const handleRecordingCompleteIntervention = async (blob: Blob) => {
    console.log('=== Chat Recording Complete (Intervention) ===');

    setLoadingMessage('文字起こし中...');
    setIsLoading(true);

    try {
      // 1. Upload to Supabase
      const { uploadAudio } = await import('@/features/voice-diary/actions/uploadAudio');
      const uploadResult = await uploadAudio(blob, 'intervention');

      // 2. Call Whisper Segmented API (句読点分割)
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

      // 3. Call Emotion Analysis Segmented API (セグメント単位)
      setLoadingMessage('感情分析中...');
      const emotionResponse = await fetch('/api/analyze-emotion-segmented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recordingId: uploadResult.recordingId,
          filePath: uploadResult.filePath,
        }),
      });

      if (!emotionResponse.ok) {
        console.warn('Emotion analysis failed, continuing without emotion data');
      }

      // 4. transcription_segmentsからセグメントデータを取得
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data: transcriptionSegments } = await supabase
        .from('transcription_segments')
        .select('id, text, start_time, end_time, emotion_label, arousal, valence, dominance')
        .eq('recording_id', uploadResult.recordingId)
        .order('segment_index', { ascending: true }) as { data: TranscriptionSegmentData[] | null };

      // 5. 平均VAD値を計算
      let avgArousal = 0;
      let avgValence = 0;
      let avgDominance = 0;

      if (transcriptionSegments && transcriptionSegments.length > 0) {
        const validSegments = transcriptionSegments.filter(
          s => s.arousal !== null && s.valence !== null && s.dominance !== null
        );

        if (validSegments.length > 0) {
          avgArousal = validSegments.reduce((sum, s) => sum + s.arousal!, 0) / validSegments.length;
          avgValence = validSegments.reduce((sum, s) => sum + s.valence!, 0) / validSegments.length;
          avgDominance = validSegments.reduce((sum, s) => sum + s.dominance!, 0) / validSegments.length;
        }
      }

      // 6. ユーザーメッセージをUIに追加（セグメントデータ付き）
      const userMessage: ChatMessage = {
        role: 'user',
        content: whisperData.text,
        full_text: whisperData.text,
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

      // 7. AI応答生成（感情データ付き）
      setLoadingMessage('AIが考えています...');

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

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: aiData.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

    } catch (error) {
      console.error('Error processing recording (intervention):', error);
      setIsLoading(false);
    }
  };

  // 対照群用: 感情分析なし
  const handleRecordingCompleteBaseline = async (blob: Blob) => {
    console.log('=== Chat Recording Complete (Baseline) ===');

    setLoadingMessage('文字起こし中...');
    setIsLoading(true);

    try {
      // 1. Upload to Supabase
      const { uploadAudio } = await import('@/features/voice-diary/actions/uploadAudio');
      const uploadResult = await uploadAudio(blob, 'baseline');

      // 2. Call Whisper Segmented API (句読点分割のみ、感情分析なし)
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

      // 3. ユーザーメッセージをUIに追加（感情データなし）
      const userMessage: ChatMessage = {
        role: 'user',
        content: whisperData.text,
        full_text: whisperData.text,
        timestamp: new Date().toISOString(),
        // segments と emotionData は渡さない
      };

      setMessages(prev => [...prev, userMessage]);

      // 4. AI応答生成（感情データなし、ベースライン用API）
      setLoadingMessage('AIが考えています...');

      const aiResponse = await fetch('/api/ai-chat-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userMessage: whisperData.text,
          recordingId: uploadResult.recordingId,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error('AI Chat Baseline API failed');
      }

      const aiData = await aiResponse.json();

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: aiData.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

    } catch (error) {
      console.error('Error processing recording (baseline):', error);
      setIsLoading(false);
    }
  };

  // 現在のモードに応じたハンドラーを返す
  const handleRecordingComplete = experimentGroup === 'intervention'
    ? handleRecordingCompleteIntervention
    : handleRecordingCompleteBaseline;

  const generateSummaryAndRedirect = async () => {
    setIsGeneratingSummary(true);
    setLoadingMessage('日記を生成しています...');
    setIsLoading(true);

    try {
      const date = new Date().toISOString().split('T')[0];

      // サマリー生成API呼び出し
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date }),
      });

      if (!response.ok) {
        throw new Error('Summary generation failed');
      }

      const data = await response.json();
      console.log('Summary generated:', data);

      // 日記ページに遷移
      router.push(`/diary/${date}`);

    } catch (error) {
      console.error('Error generating summary:', error);
      setIsLoading(false);
      setIsGeneratingSummary(false);
    }
  };

  return (
    <div className="min-h-screen panel">
      {user && <UserHeader user={user} />}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-6">
            <Link href="/dashboard">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" />
                ダッシュボードに戻る
              </button>
            </Link>

            <div className="glass soft-shadow rounded-[24px] p-4 sm:p-6">
              {/* タイトル行 */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-3 rounded-full bg-primary/10">
                    <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-semibold">AIとの対話</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      音声で気持ちを話してみましょう
                    </p>
                  </div>
                </div>

                {/* 右側: ボタン類（スマホでは非表示、下部に移動） */}
                <div className="hidden sm:flex items-center gap-3">
                  <button
                    onClick={generateSummaryAndRedirect}
                    disabled={isGeneratingSummary || messages.filter(m => m.role === 'user').length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {isGeneratingSummary ? '生成中...' : '日記を生成'}
                    </span>
                  </button>

                  {recordingLimit && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                      <span className="text-sm font-medium">
                        今日の録音: {recordingLimit.used}/{recordingLimit.total}回
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        残り{recordingLimit.remaining}回
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* モード切替タブ */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <Tabs
                  value={experimentGroup}
                  onValueChange={(v) => setExperimentGroup(v as ExperimentGroup)}
                  className="w-full"
                >
                  <TabsList className="w-full grid grid-cols-2 h-auto p-1">
                    <TabsTrigger
                      value="intervention"
                      className="flex items-center justify-center gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>感情分析あり</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="baseline"
                      className="flex items-center justify-center gap-2 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <FileAudio className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>感情分析なし</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* モード説明 */}
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  {experimentGroup === 'intervention'
                    ? '音声から感情を分析し、AIが深掘り対話を行います'
                    : '音声の文字起こしとシンプルな対話のみ行います'}
                </p>
              </div>

              {/* スマホ用: ボタン類 */}
              <div className="flex sm:hidden items-center justify-between gap-2 mt-4 pt-4 border-t border-border/50">
                <button
                  onClick={generateSummaryAndRedirect}
                  disabled={isGeneratingSummary || messages.filter(m => m.role === 'user').length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{isGeneratingSummary ? '生成中...' : '日記を生成'}</span>
                </button>

                {recordingLimit && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted text-xs">
                    <span>残り{recordingLimit.remaining}回</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2カラムレイアウト */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}>
            {/* 左カラム: チャット履歴 */}
            <div className="flex flex-col min-h-0">
              <div className="mb-3 flex-shrink-0">
                <h2 className="text-sm font-semibold text-muted-foreground">💬 対話履歴</h2>
              </div>
              <div className="flex-1 rounded-[20px] soft-shadow overflow-hidden flex flex-col min-h-0 glass">
                <div className="flex-1 overflow-y-auto">
                  <ChatInterface
                    messages={messages}
                    isLoading={isLoading}
                    loadingMessage={loadingMessage}
                  />
                </div>
              </div>
            </div>

            {/* 右カラム: 音声録音 */}
            <div className="flex flex-col">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground">🎙️ 音声録音</h2>
              </div>
              <div className="glass soft-shadow rounded-[24px] p-6">
                <div className="mb-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    録音ボタンを押して話してください
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {experimentGroup === 'intervention'
                      ? '文字起こしと感情分析が自動で行われます'
                      : '文字起こしが自動で行われます'}
                  </p>
                </div>
                <VoiceRecorder
                  onRecordingComplete={handleRecordingComplete}
                  maxDuration={60000}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
