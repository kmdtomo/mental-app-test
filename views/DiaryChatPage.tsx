'use client';

import { useState, useEffect } from 'react';
import { ChatInterface, ChatMessage } from '@/features/diary-chat/components';
import { UserHeader } from '@/features/voice-diary/components/UserHeader';
import { VoiceRecorder } from '@/features/voice-diary/components/VoiceRecorder';
import { Card } from '@/components/ui/Card';
import { MessageCircle, ArrowLeft } from 'lucide-react';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('処理中...');

  // 初回ロード時に今日の対話履歴を取得
  useEffect(() => {
    loadTodayDialogue();
  }, []);

  const loadTodayDialogue = async () => {
    console.log('=== Loading Today Dialogue ===');
    const result = await getTodayDialogue();

    if (result.success && result.messages) {
      console.log('Loaded messages:', result.messages.length);
      const chatMessages: ChatMessage[] = result.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        inputType: msg.input_type as 'text' | 'voice' | undefined
      }));
      setMessages(chatMessages);
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

      // 2. Call Whisper API and Emotion Analysis in parallel
      const [whisperResponse, emotionResponse] = await Promise.all([
        fetch('/api/whisper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            recordingId: uploadResult.recordingId,
            filePath: uploadResult.filePath,
            duration: duration,
          }),
        }),
        fetch('/api/analyze-emotion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            recordingId: uploadResult.recordingId,
            filePath: uploadResult.filePath,
          }),
        })
      ]);

      if (!whisperResponse.ok) {
        throw new Error('Whisper API failed');
      }

      const whisperData = await whisperResponse.json();
      const emotionData = emotionResponse.ok ? await emotionResponse.json() : null;

      // 3. ユーザーメッセージをUIに追加（文字起こし + 感情データ）
      const userMessage: ChatMessage = {
        role: 'user',
        content: whisperData.originalText,
        timestamp: new Date().toISOString(),
        emotionData: emotionData?.emotion ? {
          segments: emotionData.emotion.segments,
          total_segments: emotionData.emotion.summary?.total_segments || emotionData.emotion.segments?.length || 0,
          avg_arousal: emotionData.emotion.summary?.avg_arousal || 0,
          avg_valence: emotionData.emotion.summary?.avg_valence || 0,
          avg_dominance: emotionData.emotion.summary?.avg_dominance || 0
        } : undefined
      };

      setMessages(prev => [...prev, userMessage]);

      // 4. AIが考え中のローディング表示を開始
      // 注: ユーザーメッセージは既にWhisper APIがdialogue_turnsに保存済み
      setLoadingMessage('AIが考えています...');
      setIsLoading(true);

      // 5. AI応答生成
      console.log('Calling AI Chat API...');
      const aiResponse = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userMessage: whisperData.originalText,
          recordingId: uploadResult.recordingId,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error('AI Chat API failed');
      }

      const aiData = await aiResponse.json();
      console.log('AI response:', aiData);

      // 6. AI応答をチャットに追加（DBへの保存はAPI内で実施済み）
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: aiData.response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);

    } catch (error) {
      console.error('Error processing recording:', error);
      setIsLoading(false);
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

          {/* 2カラムレイアウト */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-320px)]">
            {/* 左カラム: チャット履歴 */}
            <div className="flex flex-col">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground">💬 対話履歴</h2>
              </div>
              <Card className="flex-1 rounded-[20px] soft-shadow overflow-hidden">
                <ChatInterface
                  messages={messages}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                />
              </Card>
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
