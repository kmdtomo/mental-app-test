import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { 
  Heart, 
  LayoutDashboard, 
  MessageCircle, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Mic,
  MicOff,
  Activity,
  Sparkles,
  BookOpen,
  User
} from 'lucide-react';
import { EmotionPoint, ConnectionState } from './types';
import EmotionChart from './components/EmotionChart';
import SummaryRadar from './components/SummaryRadar';
import { 
  base64ToUint8Array, 
  decodeAudioData, 
  createPcmBlob, 
  calculateRMS, 
  estimateValence 
} from './utils/audio';

// --- Constants ---
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const SYSTEM_INSTRUCTION = `You are an empathetic, emotionally intelligent listener. 
Engage in a natural conversation in Japanese. Focus on understanding the user's feelings.`;

export default function App() {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [emotionData, setEmotionData] = useState<EmotionPoint[]>([]);
  const [currentText, setCurrentText] = useState<{user: string, model: string}>({ user: '', model: '' });

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Ref for temporary data accumulation (for the graph)
  const currentChunkRMS = useRef<number[]>([]);
  const startTimeRef = useRef<number>(Date.now());

  // --- Realism & Sophistication: Mock Data Scenario (Japanese) ---
  const generateMockData = () => {
    const now = Date.now();
    const baseTime = now - (8 * 60 * 1000); // 8 minutes ago

    const scenario = [
      { offset: 0,   val: 0.50, arousal: 0.3, spk: 'user', text: "今日は正直、すごく疲れました。" },
      { offset: 30,  val: 0.55, arousal: 0.3, spk: 'model', text: "お疲れ様です。何か大変なことがあったんですか？" },
      { offset: 90,  val: 0.35, arousal: 0.4, spk: 'user', text: "会議続きで、自分の仕事をする時間が全く取れなくて…。" },
      { offset: 140, val: 0.45, arousal: 0.3, spk: 'model', text: "それは消耗しますね。自分のペースが乱されるのは辛いものです。" },
      { offset: 200, val: 0.25, arousal: 0.6, spk: 'user', text: "そうなんです！しかも夕方に急な修正依頼が来て、もうパニックでした。" }, 
      { offset: 250, val: 0.60, arousal: 0.5, spk: 'model', text: "それでも、なんとか乗り切ったんですね。すごいです。" },
      { offset: 320, val: 0.70, arousal: 0.6, spk: 'user', text: "ええ、なんとか終わらせました。終わってみれば、意外と大丈夫でした。" }, 
      { offset: 380, val: 0.85, arousal: 0.4, spk: 'model', text: "素晴らしいです！その頑張りは、きっと誰かが見ていますよ。" },
      { offset: 450, val: 0.90, arousal: 0.5, spk: 'user', text: "ありがとうございます。話したら少し気持ちが軽くなりました。" } 
    ];

    const points: EmotionPoint[] = scenario.map((s, i) => {
      const timestamp = baseTime + (s.offset * 1000);
      const minutes = Math.floor(s.offset / 60);
      const seconds = s.offset % 60;
      return {
        id: `mock-${i}`,
        timestamp: timestamp,
        formattedTime: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        arousal: s.arousal,
        valence: s.val,
        speaker: s.spk as 'user' | 'model',
        text: s.text
      };
    });

    setEmotionData(points);
  };

  // Load mock data on mount
  useEffect(() => {
    generateMockData();
  }, []);

  const stopAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const connect = async () => {
    if (!process.env.API_KEY) {
      setError("API Key is missing from environment variables.");
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);
      setEmotionData([]); 
      startTimeRef.current = Date.now();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      inputContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const rms = calculateRMS(inputData);
              currentChunkRMS.current.push(rms);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            handleServerMessage(message, outputCtx);
          },
          onclose: () => {
            setConnectionState(ConnectionState.DISCONNECTED);
            stopAudio();
          },
          onerror: (e) => {
            setConnectionState(ConnectionState.ERROR);
            setError("接続エラーが発生しました");
            console.error(e);
            stopAudio();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: { model: MODEL_NAME },
          outputAudioTranscription: {},
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      setConnectionState(ConnectionState.ERROR);
      setError(err.message || "接続に失敗しました");
      stopAudio();
    }
  };

  const disconnect = async () => {
    stopAudio();
    setConnectionState(ConnectionState.DISCONNECTED);
  };

  const handleServerMessage = async (message: LiveServerMessage, ctx: AudioContext) => {
    const serverContent = message.serverContent;
    if (serverContent) {
      if (serverContent.outputTranscription) {
        setCurrentText(prev => ({ ...prev, model: prev.model + serverContent.outputTranscription.text }));
      }
      if (serverContent.inputTranscription) {
        setCurrentText(prev => ({ ...prev, user: prev.user + serverContent.inputTranscription.text }));
      }

      if (serverContent.turnComplete) {
        const userLen = currentText.user.length;
        const modelLen = currentText.model.length;
        
        let text = currentText.model;
        const now = Date.now();
        const elapsed = (now - startTimeRef.current) / 1000;
        const minutes = Math.floor(elapsed / 60);
        const seconds = Math.floor(elapsed % 60);
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        let arousal = 0.5;
        if (currentChunkRMS.current.length > 0) {
           const avg = currentChunkRMS.current.reduce((a,b)=>a+b, 0) / currentChunkRMS.current.length;
           arousal = Math.min(1.0, avg * 8); 
           currentChunkRMS.current = [];
        } else {
           arousal = 0.3;
        }

        if (userLen > 0) {
           const valence = estimateValence(currentText.user);
           const pt: EmotionPoint = {
             id: `user-${now}`,
             timestamp: now,
             formattedTime,
             arousal: Math.max(0.1, Math.min(1, arousal + (Math.random()*0.2-0.1))),
             valence,
             speaker: 'user',
             text: currentText.user
           };
           setEmotionData(prev => [...prev, pt]);
        }

        if (modelLen > 0) {
            const valence = estimateValence(currentText.model);
            const pt: EmotionPoint = {
              id: `model-${now}`,
              timestamp: now,
              formattedTime,
              arousal: Math.max(0.1, Math.min(1, arousal * 0.8)),
              valence,
              speaker: 'model',
              text: currentText.model
            };
            setEmotionData(prev => [...prev, pt]);
        }
        setCurrentText({ user: '', model: '' });
      }

      const audioData = serverContent.modelTurn?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const nextStartTime = nextStartTimeRef.current;
        const currentTime = ctx.currentTime;
        const startTime = Math.max(nextStartTime, currentTime);
        const decodedBuffer = await decodeAudioData(base64ToUint8Array(audioData), ctx, 24000);
        const source = ctx.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(ctx.destination);
        source.start(startTime);
        sourcesRef.current.add(source);
        source.onended = () => { sourcesRef.current.delete(source); };
        nextStartTimeRef.current = startTime + decodedBuffer.duration;
      }
      
      if (serverContent.interrupted) {
         sourcesRef.current.forEach(s => s.stop());
         sourcesRef.current.clear();
         nextStartTimeRef.current = 0;
         setCurrentText({ user: '', model: '' });
      }
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-[#FBF7F3] text-[#3D3632] font-sans">
      
      {/* Sidebar - Matching ID 13:2 */}
      <aside className="shrink-0 w-64 h-screen sticky top-0 bg-[#FAF5F0] flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="flex justify-center items-center w-10 h-10 rounded-full bg-[#C17B68] shadow-[0_2px_8px_rgba(193,123,104,0.25)]">
              <Heart className="text-white text-lg w-5 h-5" />
            </div>
            <span className="text-xl font-semibold text-[#3D3632]">Mental-Test</span>
          </div>
        </div>

        <nav className="flex-1 px-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-full hover:bg-[#C17B68]/10 text-[#6B5F58] cursor-pointer transition-colors">
              <div className="w-5 h-5 flex justify-center items-center">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="text-lg">ダッシュボード</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-[#C17B68]/10 text-[#C17B68] font-medium cursor-pointer transition-colors">
              <div className="w-5 h-5 flex justify-center items-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span className="text-lg">対話</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-full hover:bg-[#C17B68]/10 text-[#6B5F58] cursor-pointer transition-colors">
              <div className="w-5 h-5 flex justify-center items-center">
                <Settings className="w-4 h-4" />
              </div>
              <span className="text-lg">設定</span>
            </div>
          </div>
        </nav>

        <div className="p-6 pb-8">
          <div className="flex items-center gap-3 p-4 rounded-[20px] bg-white/70 shadow-[0_2px_8px_rgba(193,123,104,0.12)]">
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shadow-[0_2px_6px_rgba(193,123,104,0.15)] flex items-center justify-center">
               <img src="https://static.paraflowcontent.com/public/resource/image/fe38b5a2-745b-4c6e-9571-919fa4efd421.jpeg" alt="User" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'; }} />
            </div>
            <div>
              <div className="text-lg font-semibold text-[#3D3632]">田中 太郎</div>
              <div className="text-base text-[#6B5F58]">プレミアム会員</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Matching ID 13:29 */}
      <main className="flex-1 overflow-x-hidden p-8 lg:p-12">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-semibold text-[#3D3632]">日記詳細</h1>
            
            <div className="flex items-center gap-4">
               {/* Mic Button Integration */}
               {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
                <button
                  onClick={connect}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-[#C17B68] text-white shadow-md hover:shadow-lg transition-all hover:scale-105"
                  title="録音開始"
                >
                  <Mic className="w-5 h-5" />
                </button>
              ) : (
                 <button
                  onClick={disconnect}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#C17B68] text-[#C17B68] animate-pulse shadow-md"
                  title="録音停止"
                >
                  <MicOff className="w-5 h-5" />
                </button>
              )}

              {/* Navigation */}
              <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-md transition-shadow text-[#6B5F58]">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xl font-semibold text-[#3D3632] min-w-[160px] text-center">
                2024年1月15日
              </span>
              <button onClick={generateMockData} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/70 shadow-[0_2px_6px_rgba(193,123,104,0.12)] hover:shadow-md transition-shadow text-[#6B5F58]" title="データ更新">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-lg text-[#6B5F58]">今日の心の状態を振り返りましょう</p>
        </div>

        {/* Grid Layout - Matching ID 13:41 */}
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

          {/* New Section: Diary Summary & AI Advice */}
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
                  {emotionData.length > 0 
                    ? "仕事での連続した会議や、急な修正依頼により一時的に強いストレスを感じていました。しかし、対話を通じて状況を整理し、最終的には「なんとかなった」という達成感と安心感を取り戻しています。全体を通して、困難を乗り越えるレジリエンス（回復力）が発揮された一日でした。"
                    : "対話データがまだありません。マイクボタンを押して、今日の出来事を話してください。AIがあなたの日記を作成します。"}
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
                 {emotionData.length > 0
                   ? "「終わりよければすべてよし」ですね！パニックになりそうな状況でも、投げ出さずに完遂できたことは大きな自信になるはずです。今夜は仕事のことは忘れて、ゆっくりと自分を労ってあげてくださいね。本当にお疲れ様でした。"
                   : "今日もお疲れ様です。どんな些細なことでも構いません。あなたの気持ちを聞かせてくださいね。"}
               </p>
            </div>
          </div>

          {/* Bottom Full Width: Transcript Log styled as Diary */}
          <div className="md:col-span-3 bg-white rounded-[32px] shadow-[0_4px_20px_rgba(193,123,104,0.08)] p-8 border border-[#F5EBE0]">
             <h3 className="text-[#6B5F58] font-bold text-lg mb-6 border-b border-[#F5EBE0] pb-4 flex items-center gap-2">
               <MessageCircle className="w-5 h-5" /> 会話ログ
             </h3>
             <div className="space-y-6 max-h-[300px] overflow-y-auto pr-4 no-scrollbar">
                {emotionData.length === 0 && (
                   <div className="text-center text-[#C17B68]/40 py-8 italic">
                     会話を始めると、ここに記録が表示されます...
                   </div>
                )}
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

      </main>
    </div>
  );
}