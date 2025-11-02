'use client';

import { useState, useEffect } from 'react';
import { ChatInterface, ChatMessage } from '@/features/diary-chat/components';
import { UserHeader } from '@/features/voice-diary/components/UserHeader';
import { Card } from '@/components/ui/Card';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { saveUserMessage, getTodayDialogue } from '@/features/diary-chat/actions/chatActions';

interface DiaryChatPageProps {
  user?: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
}

export function DiaryChatPage({ user }: DiaryChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 初回ロード時に今日の対話履歴を取得
  useEffect(() => {
    loadTodayDialogue();
  }, []);

  const loadTodayDialogue = async () => {
    const result = await getTodayDialogue();

    if (result.success && result.messages) {
      const chatMessages: ChatMessage[] = result.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
        inputType: msg.input_type as 'text' | 'voice' | undefined
      }));
      setMessages(chatMessages);
    }
  };

  const handleSendMessage = async (content: string, inputType: 'text' | 'voice') => {
    // ユーザーメッセージを即座にUIに表示
    const userMessage: ChatMessage = {
      role: 'user',
      content: content,
      timestamp: new Date().toISOString(),
      inputType: inputType
    };
    setMessages(prev => [...prev, userMessage]);

    // DBに保存
    const saveResult = await saveUserMessage(content, inputType);

    if (!saveResult.success) {
      console.error('Failed to save message:', saveResult.error);
      // エラー表示（オプション）
    }

    // AI応答を生成（将来実装）
    setIsLoading(true);

    // TODO: OpenAI API呼び出し
    // const aiResponse = await callAI(messages);
    // const aiMessage: ChatMessage = {
    //   role: 'assistant',
    //   content: aiResponse,
    //   timestamp: new Date().toISOString()
    // };
    // setMessages(prev => [...prev, aiMessage]);
    // await saveAIMessage(aiResponse);

    // 仮の応答（デモ用）
    setTimeout(() => {
      const demoAIMessage: ChatMessage = {
        role: 'assistant',
        content: 'ありがとうございます。もう少し詳しく教えていただけますか？（AI機能は準備中です）',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, demoAIMessage]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen panel">
      {user && <UserHeader user={user} />}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-6">
            <Link href="/voice-diary">
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" />
                音声日記に戻る
              </button>
            </Link>

            <div className="glass soft-shadow rounded-[24px] p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">AIとの対話</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    今日の気持ちについて話してみましょう
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* チャットインターフェース */}
          <Card className="rounded-[20px] soft-shadow overflow-hidden" style={{ height: 'calc(100vh - 300px)' }}>
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </Card>

          {/* ヘルプテキスト */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <p>AIがあなたの本音を引き出すサポートをします</p>
            <p className="mt-1">音声またはテキストで気軽に話しかけてください</p>
          </div>
        </div>
      </div>
    </div>
  );
}
