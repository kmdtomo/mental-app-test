'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { MessageCircle, Mic } from 'lucide-react';

interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  input_type: string | null;
}

interface DialogueHistoryCardProps {
  turns: DialogueTurn[];
}

export function DialogueHistoryCard({ turns }: DialogueHistoryCardProps) {
  console.log('=== DialogueHistoryCard Render ===');
  console.log('Turns:', turns?.length);

  if (!turns || turns.length === 0) {
    return null;
  }

  return (
    <Card className="glass soft-shadow rounded-[20px] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full bg-primary/10">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">AIとの対話</h2>
      </div>

      <div className="space-y-4">
        {turns.map((turn, index) => (
          <div
            key={index}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                turn.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{turn.content}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs opacity-70">
                  {new Date(turn.created_at).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                {turn.role === 'user' && turn.input_type === 'voice' && (
                  <Mic className="h-3 w-3 opacity-70" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
