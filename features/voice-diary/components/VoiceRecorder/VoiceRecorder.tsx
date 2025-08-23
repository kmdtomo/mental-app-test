'use client';

import { useState, useRef } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useAudioVisualizer } from '../../hooks/useAudioVisualizer';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  maxDuration?: number;
  className?: string;
}

export function VoiceRecorder({ 
  onRecordingComplete,
  maxDuration = 60000,
  className 
}: VoiceRecorderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const recordingDurationRef = useRef(0);
  
  const {
    isRecording,
    isStarting,
    duration,
    formattedDuration,
    error,
    stream,
    startRecording,
    stopRecording
  } = useVoiceRecorder({
    maxDuration,
    onRecordingComplete: async (blob) => {
      setIsProcessing(true);
      try {
        await onRecordingComplete?.(blob, Math.ceil(recordingDurationRef.current / 1000));
      } finally {
        setIsProcessing(false);
      }
    }
  });

  const canvasRef = useAudioVisualizer(stream);
  const progressPercentage = (duration / maxDuration) * 100;
  
  // Track the duration for passing to onRecordingComplete
  if (isRecording) {
    recordingDurationRef.current = duration;
  }

  return (
    <Card className={cn("rounded-[24px] overflow-hidden soft-shadow", className)}>
      <CardContent className="px-6 py-4 md:py-6">
        {/* 円形プレーヤー領域 */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex size-56 md:size-64 items-center justify-center rounded-full glass inner-soft">
            {/* 進捗リング */}
            <div className="absolute inset-0 rounded-full" aria-hidden>
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" className="stroke-muted" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="46" className="stroke-primary" strokeWidth="8" fill="none" strokeLinecap="round" style={{ strokeDasharray: 289, strokeDashoffset: 289 - (289 * progressPercentage) / 100 }} />
              </svg>
            </div>
            {/* 中央時間表示 */}
            <div className="text-center select-none">
              <div className="text-4xl font-semibold tracking-tight">
                {isRecording || isStarting ? formattedDuration : '00:00'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">最大 {formatDuration(maxDuration)}</div>
            </div>
          </div>

          {/* ビジュアライザ */}
          {(isRecording || isStarting) && (
            <div className="w-full max-w-2xl h-24 rounded-xl bg-muted overflow-hidden inner-soft">
              <canvas ref={canvasRef} width={600} height={96} className="size-full" />
            </div>
          )}

          {/* コントロール */}
          <div className="flex justify-center">
            {!isRecording ? (
              <Button onClick={startRecording} disabled={isProcessing} size="lg" className="rounded-full h-14 min-w-[240px] px-20 text-base bg-primary text-primary-foreground shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:brightness-100 active:translate-y-0">
                {isProcessing ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    <span className="ml-2">処理中...</span>
                  </>
                ) : (
                  <>
                    <Mic className="size-5" />
                    <span className="ml-2">{isStarting ? '準備中...' : '録音開始'}</span>
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full h-14 px-20 min-w-[240px] text-base shadow-md">
                <Square className="size-5" />
                <span className="ml-2">録音停止</span>
              </Button>
            )}
          </div>

          {/* ステータス/エラー */}
          <div className="pt-0 text-center">
            <h3 className="m-0 text-lg font-medium leading-tight">
              {isRecording ? '録音中...' : '音声を録音してください'}
            </h3>
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          </div>

          {!isRecording && !isProcessing && (
            <p className="mt-0 text-center text-sm text-muted-foreground leading-tight">
              マイクへのアクセスを許可して、今日の出来事を話してください。
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}