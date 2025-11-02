'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Mic } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  emotionData?: {
    segments: any[];
    total_segments: number;
    avg_arousal: number;
    avg_valence: number;
    avg_dominance: number;
  };
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  loadingMessage?: string;
}

export function ChatInterface({ messages, isLoading = false, loadingMessage = 'AIが考えています...' }: ChatInterfaceProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">録音ボタンを押して、今日の気持ちを話してみましょう</p>
            <p className="text-xs mt-2">AIがあなたの本音を引き出すお手伝いをします</p>
          </div>
        )}

        {messages.map((message, index) => {
          const isExpanded = expandedMessages.has(index);

          return (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString('ja-JP', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {message.role === 'user' && (
                    <Mic className="h-3 w-3 opacity-70" />
                  )}
                </div>

                {/* 感情データがある場合は詳細表示ボタン */}
                {message.role === 'user' && message.emotionData && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <button
                      onClick={() => toggleExpand(index)}
                      className="flex items-center gap-2 text-xs opacity-90 hover:opacity-100 transition-opacity"
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
                        {/* 総評 */}
                        <div className="p-3 rounded-lg bg-black/10 dark:bg-white/10">
                          <p className="font-semibold mb-2">
                            {vadToEmotion(
                              message.emotionData.avg_arousal,
                              message.emotionData.avg_valence,
                              message.emotionData.avg_dominance
                            )}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="opacity-70">覚醒度:</span>
                              <p className="font-mono">{message.emotionData.avg_arousal.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="opacity-70">快度:</span>
                              <p className="font-mono">{message.emotionData.avg_valence.toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="opacity-70">優位性:</span>
                              <p className="font-mono">{message.emotionData.avg_dominance.toFixed(2)}</p>
                            </div>
                          </div>
                          <p className="mt-2 opacity-70">
                            {message.emotionData.total_segments}個の発話区間を検出
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

        {isLoading && (
          <div className={`flex ${loadingMessage.includes('AI') ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              loadingMessage.includes('AI') ? 'bg-muted' : 'bg-primary/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className={`text-sm ${loadingMessage.includes('AI') ? 'text-muted-foreground' : 'text-primary'}`}>
                  {loadingMessage}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 自動スクロール用の要素 */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
