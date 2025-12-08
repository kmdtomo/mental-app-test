'use client';

import { User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatMessageListProps {
  messages?: Message[];
}

const defaultMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'こんにちは！今日の気分はいかがですか？何かお話ししたいことがあれば、遠慮なくお聞かせください。',
    timestamp: '09:15',
  },
  {
    id: '2',
    role: 'user',
    content: '少し不安な気持ちがあります。仕事のことで悩んでいて...',
    timestamp: '09:18',
  },
  {
    id: '3',
    role: 'assistant',
    content: 'お仕事のことで不安をお感じなのですね。その気持ちを話してくださってありがとうございます。どのような点で特に心配されているか、もう少し詳しく教えていただけますか？',
    timestamp: '09:19',
  },
];

export function ChatMessageList({ messages = defaultMessages }: ChatMessageListProps) {
  return (
    <div className="overflow-y-auto max-h-80">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start gap-3 mb-4 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {message.role === 'assistant' && (
            <div className="flex shrink-0 justify-center items-center w-8 h-8 rounded-full bg-[#C4856B]/8">
              <User className="text-base text-[#C4856B]" size={16} />
            </div>
          )}

          <div className={message.role === 'user' ? 'flex justify-end grow shrink' : 'grow shrink'}>
            <div
              className={`p-3 ${
                message.role === 'user'
                  ? 'bg-[#C4856B] text-white/92 max-w-[75%] rounded-[1rem_0.375rem_1rem_1rem]'
                  : 'bg-[#C4856B]/8 text-[#3D3330] rounded-[0.375rem_1rem_1rem]'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <span
                className={`text-xs block mt-1 ${
                  message.role === 'user' ? 'text-white/70' : 'text-[#9A8D88]'
                }`}
              >
                {message.timestamp}
              </span>
            </div>
          </div>

          {message.role === 'user' && (
            <div className="flex shrink-0 justify-center items-center w-8 h-8 rounded-full bg-[#D9A08A]">
              <User className="text-base text-white/92" size={16} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
