'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Mic } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;  // AIメッセージやテキスト入力用（互換性のため残す）
  full_text?: string; // 句読点を含む全文
  timestamp: string;
  // 音声入力の場合、セグメントデータを使用
  segments?: Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    emotion_label: string | null;
    arousal: number | null;
    valence: number | null;
    dominance: number | null;
  }>;
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

  // 感情ラベルから各種クラスを取得
  const getEmotionClasses = (emotionLabel: string | null) => {
    const base = {
      text: '',
      border: 'border-transparent',
      hoverBg: 'hover:bg-transparent',
    };

    if (!emotionLabel) return base;

    const label = emotionLabel.toLowerCase();

    if (label.includes('喜び') || label.includes('興奮') || label.includes('満足')) {
      return { text: 'text-yellow-400', border: 'border-yellow-400', hoverBg: 'hover:bg-yellow-400/20' };
    }
    if (label.includes('悲し') || label.includes('疲労') || label.includes('疲れ')) {
      return { text: 'text-blue-400', border: 'border-blue-400', hoverBg: 'hover:bg-blue-400/20' };
    }
    if (label.includes('ストレス') || label.includes('緊張')) {
      return { text: 'text-red-400', border: 'border-red-400', hoverBg: 'hover:bg-red-400/20' };
    }
    if (label.includes('落ち込') || label.includes('沈')) {
      return { text: 'text-purple-400', border: 'border-purple-400', hoverBg: 'hover:bg-purple-400/20' };
    }
    if (label.includes('穏やか') || label.includes('リラックス')) {
      return { text: 'text-green-400', border: 'border-green-400', hoverBg: 'hover:bg-green-400/20' };
    }
    if (label.includes('落ち着き')) {
      return { text: 'text-teal-400', border: 'border-teal-400', hoverBg: 'hover:bg-teal-400/20' };
    }

    return base;
  };

  const vadToEmotion = (arousal: number, valence: number, dominance: number): string => {
    // 閾値を調整（より敏感に検出）
    const arousalLow = arousal <= 3.3;
    const arousalHigh = arousal >= 3.8;
    const valenceLow = valence <= 3.8;
    const valenceHigh = valence >= 4.2;

    // 悲しみ・疲労（低覚醒・低快度）
    if (arousalLow && valenceLow) return '😢 悲しみ';

    // ストレス・緊張（高覚醒・低快度）
    if (arousalHigh && valenceLow) return '😰 ストレス';

    // 喜び・興奮（高覚醒・高快度）
    if (arousalHigh && valenceHigh) return '😊 幸せ';

    // 穏やか・リラックス（低覚醒・高快度）
    if (arousalLow && valenceHigh) return '😌 穏やか';

    // 快度が低め＋覚醒度も低め → 疲労
    if (valence < 4.0 && arousal <= 3.5) return '😴 疲労';

    // 快度が低い → 落ち込み
    if (valence < 3.7) return '😢 悲しみ';

    // 快度が高い → 満足
    if (valence >= 4.3) return '😊 幸せ';

    // 覚醒度が低い → 疲労
    if (arousal < 3.5) return '😴 疲労';

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
                    ? 'bg-orange-50 dark:bg-orange-950/20 text-foreground'
                    : 'bg-muted'
                }`}
              >
                {/* メッセージ表示ロジック */}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {(() => {
                    // アシスタントのメッセージの場合
                    if (message.role === 'assistant') {
                      return <p>{message.content}</p>;
                    }

                    // セグメントがある場合（音声入力）
                    if (message.segments && message.segments.length > 0) {
                      return message.segments.map((segment) => {
                        const { text, border, hoverBg } = getEmotionClasses(segment.emotion_label);
                        return (
                          <span
                            key={segment.id}
                            className={`px-1 rounded transition-colors duration-200 border-l-2 ${text} ${border} ${hoverBg}`}
                            title={segment.emotion_label || '中立'}
                          >
                            {segment.text}
                          </span>
                        );
                      });
                    }

                    // セグメントがない場合（テキスト入力）
                    return <p>{message.content}</p>;
                  })()}
                </div>

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
                {message.role === 'user' && message.segments && message.segments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <button
                      onClick={() => toggleExpand(index)}
                      className="flex items-center gap-2 text-xs opacity-90 hover:opacity-100 transition-opacity w-full"
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
                        {/* セグメントごとの感情分析 */}
                        {message.segments.map((segment, idx) => (
                          <div key={segment.id} className="p-3 rounded-lg bg-black/10 dark:bg-white/10">
                            <p className="font-semibold mb-2 text-sm">
                              {segment.text}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <span className="opacity-70">覚醒度:</span>
                                <p className="font-mono">
                                  {segment.arousal !== null ? segment.arousal.toFixed(2) : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span className="opacity-70">快度:</span>
                                <p className="font-mono">
                                  {segment.valence !== null ? segment.valence.toFixed(2) : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span className="opacity-70">優位性:</span>
                                <p className="font-mono">
                                  {segment.dominance !== null ? segment.dominance.toFixed(2) : 'N/A'}
                                </p>
                              </div>
                            </div>
                            <p className="mt-2 opacity-70">
                              感情: {segment.emotion_label || '中立'}
                            </p>
                          </div>
                        ))}

                        {/* 全体の統計 */}
                        {message.emotionData && (
                          <div className="p-3 rounded-lg bg-black/20 dark:bg-white/20 border-t border-white/30">
                            <p className="font-semibold mb-2">
                              全体の傾向: {vadToEmotion(
                                message.emotionData.avg_arousal,
                                message.emotionData.avg_valence,
                                message.emotionData.avg_dominance
                              )}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <span className="opacity-70">平均覚醒度:</span>
                                <p className="font-mono">{message.emotionData.avg_arousal.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="opacity-70">平均快度:</span>
                                <p className="font-mono">{message.emotionData.avg_valence.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="opacity-70">平均優位性:</span>
                                <p className="font-mono">{message.emotionData.avg_dominance.toFixed(2)}</p>
                              </div>
                            </div>
                            <p className="mt-2 opacity-70">
                              {message.emotionData.total_segments}個の発話区間を検出
                            </p>
                          </div>
                        )}
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
