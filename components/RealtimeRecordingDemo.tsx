'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RealtimeAudioProcessor } from '@/lib/realtimeAudioProcessor';
import { EmotionResult } from '@/lib/emotionLabeling';

export default function RealtimeRecordingDemo() {
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [emotion, setEmotion] = useState<EmotionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const processorRef = useRef<RealtimeAudioProcessor | null>(null);

    useEffect(() => {
        // コンポーネントマウント時にプロセッサを初期化
        const processor = new RealtimeAudioProcessor();

        processor.onTranscription = (text, isFinal) => {
            // 追記モードにするか、上書きにするかはUX次第。
            // ここでは単純に最新の認識結果を表示（会話履歴にするなら配列で管理）
            setTranscription(prev => isFinal ? prev + '\n' + text : text);
        };

        processor.onEmotionResult = (result) => {
            setEmotion(result);
        };

        processor.onError = (err) => {
            setError(err);
            setIsRecording(false);
        };

        processorRef.current = processor;

        return () => {
            if (processorRef.current) {
                processorRef.current.stop();
            }
        };
    }, []);

    const toggleRecording = async () => {
        if (!processorRef.current) return;

        if (isRecording) {
            processorRef.current.stop();
            setIsRecording(false);
        } else {
            setError(null);
            setTranscription(''); // リセット
            await processorRef.current.start();
            setIsRecording(true);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="text-center mb-8">
                <button
                    onClick={toggleRecording}
                    className={`px-8 py-4 rounded-full text-xl font-bold transition-all duration-300 transform hover:scale-105 ${isRecording
                            ? 'bg-red-500 text-white shadow-red-200 shadow-xl animate-pulse'
                            : 'bg-blue-600 text-white shadow-blue-200 shadow-xl'
                        }`}
                >
                    {isRecording ? '■ 録音停止' : '● 録音開始'}
                </button>
                {error && (
                    <p className="mt-4 text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 感情分析結果エリア */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 min-h-[200px] flex flex-col items-center justify-center">
                    <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">現在の感情 (AWS Lambda)</h2>
                    {emotion ? (
                        <div className="text-center transition-all duration-500 ease-out transform">
                            <div className="text-8xl mb-4 animate-bounce-slow filter drop-shadow-md">
                                {emotion.emoji}
                            </div>
                            <div
                                className="text-2xl font-bold px-4 py-2 rounded-lg"
                                style={{ color: emotion.color, backgroundColor: `${emotion.color}15` }}
                            >
                                {emotion.label}
                            </div>
                            <p className="text-gray-500 mt-2 text-sm">{emotion.description}</p>
                        </div>
                    ) : (
                        <div className="text-gray-300 text-center">
                            <div className="text-4xl mb-2">😶</div>
                            <p>待機中...</p>
                        </div>
                    )}
                </div>

                {/* 文字起こし結果エリア */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 min-h-[200px]">
                    <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">文字起こし (OpenAI Realtime)</h2>
                    <div className="h-48 overflow-y-auto w-full text-gray-700 whitespace-pre-wrap font-medium leading-relaxed">
                        {transcription || <span className="text-gray-300 italic">ここに会話が表示されます...</span>}
                    </div>
                </div>
            </div>

            {/* ステータスインジケータ */}
            <div className="mt-6 flex justify-center space-x-8 text-xs text-gray-400">
                <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${isRecording ? 'bg-green-500 animate-ping' : 'bg-gray-300'}`}></div>
                    OpenAI Realtime API
                </div>
                <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${emotion ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    AWS Lambda (Emotion)
                </div>
            </div>
        </div>
    );
}
