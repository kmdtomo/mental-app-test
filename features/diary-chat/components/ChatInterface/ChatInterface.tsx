'use client';

import { useState } from 'react';
import { Send, Mic, Type } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  inputType?: 'text' | 'voice';
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, inputType: 'text' | 'voice') => void;
  isLoading?: boolean;
}

export function ChatInterface({ messages, onSendMessage, isLoading = false }: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');

  const handleSendText = () => {
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText, 'text');
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">今日の気持ちを話してみましょう</p>
            <p className="text-xs mt-2">AIがあなたの本音を引き出すお手伝いをします</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                {message.role === 'user' && message.inputType === 'voice' && (
                  <Mic className="h-3 w-3 opacity-70" />
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-muted">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div className="border-t p-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setInputMode('text')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs ${
              inputMode === 'text'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Type className="h-3 w-3" />
            テキスト
          </button>
          <button
            onClick={() => setInputMode('voice')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs ${
              inputMode === 'voice'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Mic className="h-3 w-3" />
            音声
          </button>
        </div>

        {inputMode === 'text' ? (
          <div className="flex gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="メッセージを入力..."
              className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={handleSendText}
              disabled={!inputText.trim() || isLoading}
              className="rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-2">音声入力機能</p>
            <Button variant="outline" className="rounded-xl" disabled>
              <Mic className="h-4 w-4 mr-2" />
              録音開始（準備中）
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
