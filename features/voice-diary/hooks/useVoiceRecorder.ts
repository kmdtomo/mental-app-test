'use client';

import { useState, useCallback, useRef } from 'react';
import { WavRecorder, formatDuration } from '@/lib/mediaRecorder/wavRecorder';

export interface UseVoiceRecorderOptions {
  maxDuration?: number;
  onRecordingComplete?: (blob: Blob) => void;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<WavRecorder | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setIsStarting(true);
      const recorder = new WavRecorder({
        maxDuration: options.maxDuration || 60000, // Default 1 minute
        onProgress: (duration) => {
          setDuration(duration);
        },
        onStop: (blob) => {
          setIsRecording(false);
          setIsStarting(false);
          setDuration(0);
          setStream(null);
          options.onRecordingComplete?.(blob);
        },
        onStreamReady: (mediaStream) => {
          setStream(mediaStream);
          // 実記録開始は onStart で反映する
        },
        onStart: () => {
          setIsRecording(true);
          setIsStarting(false);
        }
      });

      await recorder.start();
      recorderRef.current = recorder;
      // onStart が来るまで isStarting のまま待機
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
      setIsStarting(false);
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setStream(null);
  }, []);

  const togglePause = useCallback(() => {
    // Note: MediaRecorder doesn't support pause/resume for all browsers
    // This is a placeholder for future implementation
    setIsPaused(!isPaused);
  }, [isPaused]);

  return {
    isRecording,
    isStarting,
    isPaused,
    duration,
    formattedDuration: formatDuration(duration),
    error,
    stream,
    startRecording,
    stopRecording,
    togglePause
  };
}