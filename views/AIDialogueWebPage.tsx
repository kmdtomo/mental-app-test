'use client';

import { useState } from 'react';
import { WebSidebar } from '@/components/navigation/WebSidebar';
import { Mic, FileText, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { EmotionChart } from '@/features/diary-detail-web/components';

// 感情の色を定義
const emotionColors: Record<string, string> = {
  happy: '#A8B89F',      // 緑系 - 喜び
  sad: '#7BA3C9',        // 青系 - 悲しみ
  angry: '#C17B68',      // 赤系 - 怒り
  anxious: '#D4A574',    // オレンジ系 - 不安
  neutral: '#9A8D85',    // グレー系 - 中立
};

// トランスクリプトセグメントの型
interface TranscriptSegment {
  text: string;
  emotion: string;
}

// EmotionChart用のデータ型
interface EmotionPoint {
  id: string;
  timestamp: number;
  formattedTime: string;
  arousal: number;
  valence: number;
  speaker: 'user' | 'model';
  text: string;
}

// メッセージの型
interface Message {
  id: number;
  speaker: 'user' | 'ai';
  text: string;
  formattedTime: string;
  transcript?: TranscriptSegment[];
  emotionData?: EmotionPoint[]; // グラフ用データ
}

// モックデータ - 各ユーザー発話にグラフ用データを追加
const mockEmotionData: Message[] = [
  {
    id: 1,
    speaker: 'ai',
    text: 'こんにちは！今日はどんな一日でしたか？',
    formattedTime: '14:30',
  },
  {
    id: 2,
    speaker: 'user',
    text: '今日は仕事で大変なことがあって、少し疲れています。でも、帰りに美味しいコーヒーを飲めたので、少し気分が良くなりました。',
    formattedTime: '14:31',
    transcript: [
      { text: '今日は仕事で大変なことがあって、', emotion: 'anxious' },
      { text: '少し疲れています。', emotion: 'sad' },
      { text: 'でも、帰りに美味しいコーヒーを飲めたので、', emotion: 'neutral' },
      { text: '少し気分が良くなりました。', emotion: 'happy' },
    ],
    emotionData: [
      { id: 'msg2-0', timestamp: Date.now() - 60000, formattedTime: '0:00', arousal: 0.5, valence: 0.35, speaker: 'user', text: '今日は仕事で大変なことがあって、' },
      { id: 'msg2-1', timestamp: Date.now() - 55000, formattedTime: '0:05', arousal: 0.4, valence: 0.25, speaker: 'user', text: '少し疲れています。' },
      { id: 'msg2-2', timestamp: Date.now() - 50000, formattedTime: '0:10', arousal: 0.4, valence: 0.55, speaker: 'user', text: 'でも、帰りに美味しいコーヒーを飲めたので、' },
      { id: 'msg2-3', timestamp: Date.now() - 45000, formattedTime: '0:15', arousal: 0.6, valence: 0.85, speaker: 'user', text: '少し気分が良くなりました。' },
    ],
  },
  {
    id: 3,
    speaker: 'ai',
    text: '大変な一日だったのですね。疲れている中でも、美味しいコーヒーで少しリラックスできたのは良かったです。仕事で何か特に大変だったことはありますか？',
    formattedTime: '14:32',
  },
  {
    id: 4,
    speaker: 'user',
    text: '締め切りが急に早まって、焦ってしまいました。でも、チームのみんなが助けてくれて、なんとか間に合いました。感謝しています。',
    formattedTime: '14:33',
    transcript: [
      { text: '締め切りが急に早まって、', emotion: 'anxious' },
      { text: '焦ってしまいました。', emotion: 'angry' },
      { text: 'でも、チームのみんなが助けてくれて、', emotion: 'happy' },
      { text: 'なんとか間に合いました。', emotion: 'neutral' },
      { text: '感謝しています。', emotion: 'happy' },
    ],
    emotionData: [
      { id: 'msg4-0', timestamp: Date.now() - 30000, formattedTime: '0:00', arousal: 0.6, valence: 0.35, speaker: 'user', text: '締め切りが急に早まって、' },
      { id: 'msg4-1', timestamp: Date.now() - 25000, formattedTime: '0:05', arousal: 0.8, valence: 0.20, speaker: 'user', text: '焦ってしまいました。' },
      { id: 'msg4-2', timestamp: Date.now() - 20000, formattedTime: '0:10', arousal: 0.6, valence: 0.85, speaker: 'user', text: 'でも、チームのみんなが助けてくれて、' },
      { id: 'msg4-3', timestamp: Date.now() - 15000, formattedTime: '0:15', arousal: 0.4, valence: 0.55, speaker: 'user', text: 'なんとか間に合いました。' },
      { id: 'msg4-4', timestamp: Date.now() - 10000, formattedTime: '0:20', arousal: 0.5, valence: 0.90, speaker: 'user', text: '感謝しています。' },
    ],
  },
];

// 感情に応じた色付きテキストを表示するコンポーネント
function ColoredTranscript({ segments }: { segments: TranscriptSegment[] }) {
  return (
    <p className="text-lg text-[#3D3632]">
      {segments.map((segment, index) => (
        <span
          key={index}
          style={{
            backgroundColor: `${emotionColors[segment.emotion]}20`,
            borderBottom: `2px solid ${emotionColors[segment.emotion]}`,
            paddingBottom: '2px',
          }}
        >
          {segment.text}
        </span>
      ))}
    </p>
  );
}

// 感情グラフ表示トグルコンポーネント
function EmotionChartToggle({ emotionData }: { emotionData: EmotionPoint[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2">
      {/* トグルボタン */}
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

      {/* グラフ表示エリア */}
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

export function AIDialogueWebPage() {
  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="dialogue" />

      {/* Main Content */}
      <main className="overflow-x-hidden flex grow shrink bg-[#FBF7F3] h-full">
        {/* Chat History Column */}
        <div className="flex flex-col grow shrink py-8 pl-8 pr-4 h-full">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl mb-2 font-semibold text-[#3D3632]">AIとの対話</h1>
            <p className="text-lg text-[#6B5F58]">音声でAIと対話し、あなたの気持ちを記録します</p>
          </div>

          <div className="flex flex-col grow shrink p-6 rounded-[20px] bg-white/85 shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)] min-h-0">
            <h2 className="text-2xl mb-6 font-semibold text-[#3D3332]">対話履歴</h2>
            <div className="overflow-y-auto flex-1 min-h-0 pr-4">
              {mockEmotionData.map((message) => (
                <div key={message.id} className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'} mb-6`}>
                  <div className={message.speaker === 'user' ? 'max-w-[85%]' : 'max-w-[80%]'}>
                    <div className={`p-4 rounded-[16px] ${message.speaker === 'user' ? 'rounded-br-[4px] bg-[#C17B68]/15' : 'rounded-bl-[4px] bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)]'}`}>
                      {message.speaker === 'user' && message.transcript ? (
                        <ColoredTranscript segments={message.transcript} />
                      ) : (
                        <p className="text-lg text-[#3D3632]">{message.text}</p>
                      )}
                    </div>

                    {/* ユーザー発話の場合、感情グラフトグルを表示 */}
                    {message.speaker === 'user' && message.emotionData && (
                      <EmotionChartToggle emotionData={message.emotionData} />
                    )}

                    <div className={`flex items-center gap-2 mt-2 ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-base text-[#9A8D85]">{message.formattedTime}</span>
                    </div>
                  </div>
                </div>
              ))}
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
              <button className="flex justify-center items-center w-32 h-32 rounded-full bg-[#C17B68] shadow-[0_4px_16px_rgba(193,123,104,0.3)] hover:shadow-[0_8px_24px_rgba(193,123,104,0.4)] transition-shadow">
                <Mic className="text-4xl text-white/85" size={48} />
              </button>
            </div>
            {/* Timer */}
            <div className="mb-8">
              <div className="text-3xl text-center font-semibold text-[#C17B68]">00:00</div>
              <div className="text-base text-center mt-1 text-[#6B5F58]">録音時間</div>
            </div>
            {/* Waveform Visualization */}
            <div className="flex justify-center items-center gap-1 mb-8">
              <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
              <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
              <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
              <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
              <div className="w-1 h-2 rounded-full bg-[#C17B68]"></div>
            </div>
            {/* Recording Count */}
            <div className="text-center w-full p-4 rounded-[12px] bg-[#A8B89F]/10">
              <div className="text-lg font-semibold text-[#3D3632]">残り録音回数</div>
              <div className="flex justify-center items-center gap-2 mt-2">
                <span className="text-2xl font-semibold text-[#C17B68]">3</span>
                <span className="text-lg text-[#6B5F58]">/ 5回</span>
              </div>
              <div className="mt-3">
                <div className="h-2 rounded-full bg-[#A8B89F]/20">
                  <div className="h-full rounded-full bg-[#A8B89F] w-[60%]"></div>
                </div>
              </div>
            </div>
          </div>
          {/* Generate Diary Button */}
          <div className="mt-8">
            <button className="flex justify-center items-center gap-3 w-full py-4 px-6 rounded-full bg-[#B8CAB0] text-white/85 shadow-[0_2px_8px_rgba(184,202,176,0.25)] hover:shadow-[0_4px_12px_rgba(193,123,104,0.35)] transition-shadow">
              <FileText className="text-lg" size={18} />
              <span className="text-lg whitespace-nowrap font-semibold">日記を生成</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
