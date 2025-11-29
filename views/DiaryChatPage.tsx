'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface, ChatMessage } from '@/features/diary-chat/components';
import { UserHeader } from '@/features/voice-diary/components/UserHeader';
import { VoiceRecorder } from '@/features/voice-diary/components/VoiceRecorder';
import { Card } from '@/components/ui/Card';
import { MessageCircle, ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { getTodayDialogue } from '@/features/diary-chat/actions/chatActions';

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

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    console.log('=== Chat Recording Complete ===');

    // ローディング開始（文字起こし中）
    setLoadingMessage('文字起こし中...');
    setIsLoading(true);

    try {
      // 1. Upload to Supabase
      const { uploadAudio } = await import('@/features/voice-diary/actions/uploadAudio');
      const uploadResult = await uploadAudio(blob);

      // 2. Call NEW Whisper Segmented API (句読点分割)
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

      // 3. Call NEW Emotion Analysis Segmented API (セグメント単位)
      const emotionResponse = await fetch('/api/analyze-emotion-segmented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recordingId: uploadResult.recordingId,
          filePath: uploadResult.filePath,
        }),
      });

      const emotionData = emotionResponse.ok ? await emotionResponse.json() : null;

      // 4. transcription_segmentsからセグメントデータを取得
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data: transcriptionSegments } = await supabase
        .from('transcription_segments')
        .select('id, text, start_time, end_time, emotion_label, arousal, valence, dominance')
        .eq('recording_id', uploadResult.recordingId)
        .order('segment_index', { ascending: true });

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
        content: whisperData.text, // フォールバック用
        full_text: whisperData.text, // 句読点付き全文
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

      // 7. AIが考え中のローディング表示を開始
      // 注: ユーザーメッセージは既にWhisper Segmented APIがdialogue_turnsに保存済み
      setLoadingMessage('AIが考えています...');
      setIsLoading(true);

      // 8. AI応答生成
      console.log('Calling AI Chat API...');
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
      console.log('AI response:', aiData);

      // 9. AI応答をチャットに追加（DBへの保存はAPI内で実施済み）
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: aiData.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

      // ボタンからの手動生成のみ対応

    } catch (error) {
      console.error('Error processing recording:', error);
      setIsLoading(false);
    }
  };

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

            <div className="glass soft-shadow rounded-[24px] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold">AIとの対話</h1>
                    <p className="text-sm text-muted-foreground">
                      音声で気持ちを話してみましょう
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* 要約生成ボタン */}
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

                  {/* 録音回数表示 */}
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
                    文字起こしと感情分析が自動で行われます
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
