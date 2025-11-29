'use client';

import { WebSidebar } from '@/components/navigation/WebSidebar';
import { ChevronLeft, ChevronRight, Activity, BookOpen, Sparkles, MessageCircle } from 'lucide-react';
import { EmotionChart, SummaryRadar } from '@/features/diary-detail-web/components';

interface EmotionPoint {
  id: string;
  timestamp: number;
  formattedTime: string;
  arousal: number;
  valence: number;
  speaker: 'user' | 'model';
  text: string;
}

export function DiaryDetailWebPage() {
  // Mock data
  const emotionData: EmotionPoint[] = [
    { id: 'mock-0', timestamp: Date.now() - 480000, formattedTime: '0:00', arousal: 0.3, valence: 0.50, speaker: 'user', text: '今日は正直、すごく疲れました。' },
    { id: 'mock-1', timestamp: Date.now() - 450000, formattedTime: '0:30', arousal: 0.3, valence: 0.55, speaker: 'model', text: 'お疲れ様です。何か大変なことがあったんですか？' },
    { id: 'mock-2', timestamp: Date.now() - 390000, formattedTime: '1:30', arousal: 0.4, valence: 0.35, speaker: 'user', text: '会議続きで、自分の仕事をする時間が全く取れなくて…。' },
    { id: 'mock-3', timestamp: Date.now() - 340000, formattedTime: '2:20', arousal: 0.3, valence: 0.45, speaker: 'model', text: 'それは消耗しますね。自分のペースが乱されるのは辛いものです。' },
    { id: 'mock-4', timestamp: Date.now() - 280000, formattedTime: '3:20', arousal: 0.6, valence: 0.25, speaker: 'user', text: 'そうなんです！しかも夕方に急な修正依頼が来て、もうパニックでした。' },
    { id: 'mock-5', timestamp: Date.now() - 230000, formattedTime: '4:10', arousal: 0.5, valence: 0.60, speaker: 'model', text: 'それでも、なんとか乗り切ったんですね。すごいです。' },
    { id: 'mock-6', timestamp: Date.now() - 160000, formattedTime: '5:20', arousal: 0.6, valence: 0.70, speaker: 'user', text: 'ええ、なんとか終わらせました。終わってみれば、意外と大丈夫でした。' },
    { id: 'mock-7', timestamp: Date.now() - 100000, formattedTime: '6:20', arousal: 0.4, valence: 0.85, speaker: 'model', text: '素晴らしいです！その頑張りは、きっと誰かが見ていますよ。' },
    { id: 'mock-8', timestamp: Date.now() - 30000, formattedTime: '7:30', arousal: 0.5, valence: 0.90, speaker: 'user', text: 'ありがとうございます。話したら少し気持ちが軽くなりました。' }
  ];

  return (
    <div className="flex w-[1440px] h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      {/* Sidebar */}
      <WebSidebar activeItem="dashboard" />

      {/* Main Content */}
      <main className="overflow-x-hidden overflow-y-auto grow shrink bg-[#FBF7F3] h-full">
        <div className="py-8 px-12">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-4xl font-semibold text-[#3D3632]">日記詳細</h1>
              <div className="flex items-center gap-4">
                <button className="flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)]">
                  <ChevronLeft className="text-lg text-[#6B5F58]" />
                </button>
                <span className="text-xl text-center min-w-[180px] font-semibold text-[#3D3632]">2024年1月15日</span>
                <button className="flex justify-center items-center w-10 h-10 rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-[0_4px_10px_rgba(193,123,104,0.18)]">
                  <ChevronRight className="text-lg text-[#6B5F58]" />
                </button>
              </div>
            </div>
            <p className="text-lg text-[#6B5F58]">今日の心の状態を振り返りましょう</p>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Main Chart Section - Spans 2 columns */}
            <div className="md:col-span-2 bg-white rounded-[32px] shadow-[0_4px_20px_rgba(193,123,104,0.08)] p-6 min-h-[400px] flex flex-col relative overflow-visible border border-[#F5EBE0]">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[#C17B68] font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" /> 感情の推移 (Emotional Flow)
                </h3>
                <div className="text-xs font-bold text-[#6B5F58] px-3 py-1 bg-[#FBF7F3] rounded-full">
                  リアルタイム分析
                </div>
              </div>
              <div className="flex-1 w-full h-full -ml-2">
                <EmotionChart data={emotionData} />
              </div>
            </div>

            {/* Assessment Radar Section - Spans 1 column */}
            <div className="md:col-span-1 flex flex-col gap-6">
              {/* Radar Card */}
              <div className="bg-white rounded-[32px] shadow-[0_4px_20px_rgba(193,123,104,0.08)] p-6 flex-1 min-h-[300px] flex flex-col border border-[#F5EBE0]">
                <h3 className="text-[#C17B68] font-bold uppercase tracking-wider text-sm mb-4 text-center">
                  会話バランス
                </h3>
                <div className="flex-1 w-full">
                  <SummaryRadar data={emotionData} />
                </div>
              </div>

              {/* Quick Stats Card */}
              <div className="bg-[#C17B68] rounded-[24px] shadow-[0_4px_15px_rgba(193,123,104,0.2)] p-6 text-white flex flex-col justify-center gap-2">
                <span className="text-white/80 text-xs font-bold uppercase tracking-widest">感情トレンド</span>
                <div className="text-2xl font-bold">
                  {emotionData.length > 2 ? (
                    (emotionData[emotionData.length-1].valence - emotionData[0].valence) > 0.1
                    ? "↗ 改善傾向"
                    : (emotionData[emotionData.length-1].valence - emotionData[0].valence) < -0.1
                    ? "↘ 悩みあり"
                    : "→ 安定"
                  ) : "..."}
                </div>
                <p className="text-white/70 text-sm leading-snug mt-1">
                  {emotionData.length} 回の対話から分析
                </p>
              </div>
            </div>

            {/* Diary Summary & AI Advice */}
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Diary Summary */}
              <div className="bg-[#FAF5F0] rounded-[32px] p-8 border border-[#C17B68]/10 shadow-[0_4px_15px_rgba(193,123,104,0.05)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#C17B68]/10 flex items-center justify-center text-[#C17B68]">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#3D3632]">日記の要約</h3>
                </div>
                <p className="text-[#6B5F58] leading-relaxed">
                  仕事での連続した会議や、急な修正依頼により一時的に強いストレスを感じていました。しかし、対話を通じて状況を整理し、最終的には「なんとかなった」という達成感と安心感を取り戻しています。全体を通して、困難を乗り越えるレジリエンス（回復力）が発揮された一日でした。
                </p>
              </div>

              {/* AI Advice */}
              <div className="bg-gradient-to-br from-[#C17B68] to-[#A66250] rounded-[32px] p-8 text-white shadow-[0_8px_25px_rgba(193,123,104,0.25)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">AIからのメッセージ</h3>
                </div>
                <p className="text-white/90 leading-relaxed relative z-10 font-medium text-lg">
                  「終わりよければすべてよし」ですね！パニックになりそうな状況でも、投げ出さずに完遂できたことは大きな自信になるはずです。今夜は仕事のことは忘れて、ゆっくりと自分を労ってあげてくださいね。本当にお疲れ様でした。
                </p>
              </div>
            </div>

            {/* Transcript Log */}
            <div className="md:col-span-3 bg-white rounded-[32px] shadow-[0_4px_20px_rgba(193,123,104,0.08)] p-8 border border-[#F5EBE0]">
              <h3 className="text-[#6B5F58] font-bold text-lg mb-6 border-b border-[#F5EBE0] pb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" /> 会話ログ
              </h3>
              <div className="space-y-6 max-h-[300px] overflow-y-auto pr-4">
                {emotionData.map((pt) => (
                  <div key={pt.id} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full mt-2 transition-transform group-hover:scale-125 ${pt.speaker === 'user' ? 'bg-[#C17B68]' : 'bg-[#6B5F58]'}`}></div>
                      <div className="w-px h-full bg-[#F5EBE0] my-1 group-last:hidden"></div>
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className={`text-sm font-bold ${pt.speaker === 'user' ? 'text-[#C17B68]' : 'text-[#6B5F58]'}`}>
                          {pt.speaker === 'user' ? 'あなた' : 'AIパートナー'}
                        </span>
                        <span className="text-xs text-[#C17B68]/50 font-mono">{pt.formattedTime}</span>
                      </div>
                      <p className="text-[#3D3632] text-base leading-relaxed bg-[#FBF7F3] p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl inline-block max-w-full">
                        {pt.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
