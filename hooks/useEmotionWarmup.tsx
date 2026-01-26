'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const WARMUP_INTERVAL = 60 * 1000; // 1分間隔
const WARMUP_URL = process.env.NEXT_PUBLIC_EMOTION_WARMUP_URL;
const STORAGE_KEY = 'emotion-warmup-enabled';

interface WarmupStatus {
  isEnabled: boolean;
  lastWarmupTime: Date | null;
  lastStatus: 'idle' | 'warming' | 'warm' | 'error';
  errorMessage: string | null;
}

/**
 * 感情認識エンジンのウォームアップを管理するカスタムフック
 * コールドスタートを防止するため、定期的にModalエンドポイントにpingを送信
 * 設定はlocalStorageに永続化される
 */
export function useEmotionWarmup() {
  const [status, setStatus] = useState<WarmupStatus>({
    isEnabled: false,
    lastWarmupTime: null,
    lastStatus: 'idle',
    errorMessage: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isWarmingRef = useRef(false);
  const isInitializedRef = useRef(false);

  // ウォームアップリクエストを送信
  const sendWarmupRequest = useCallback(async () => {
    if (!WARMUP_URL || isWarmingRef.current) {
      return;
    }

    isWarmingRef.current = true;
    setStatus(prev => ({ ...prev, lastStatus: 'warming' }));

    try {
      console.log('[Warmup] Sending warmup request...');
      const response = await fetch(WARMUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[Warmup] Response:', result);

      if (result.status === 'warm') {
        setStatus(prev => ({
          ...prev,
          lastWarmupTime: new Date(),
          lastStatus: 'warm',
          errorMessage: null,
        }));
      } else if (result.status === 'error') {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[Warmup] Error:', error);
      setStatus(prev => ({
        ...prev,
        lastStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      isWarmingRef.current = false;
    }
  }, []);

  // ウォームアップを開始
  const startWarmup = useCallback(() => {
    if (!WARMUP_URL) {
      console.warn('[Warmup] WARMUP_URL is not configured');
      return;
    }

    console.log('[Warmup] Starting warmup interval');
    setStatus(prev => ({ ...prev, isEnabled: true }));

    // localStorageに保存
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('[Warmup] Failed to save to localStorage:', e);
    }

    // 即座に最初のウォームアップを実行
    sendWarmupRequest();

    // 定期的なウォームアップを開始
    intervalRef.current = setInterval(() => {
      sendWarmupRequest();
    }, WARMUP_INTERVAL);
  }, [sendWarmupRequest]);

  // ウォームアップを停止
  const stopWarmup = useCallback(() => {
    console.log('[Warmup] Stopping warmup interval');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // localStorageから削除
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[Warmup] Failed to remove from localStorage:', e);
    }

    setStatus(prev => ({
      ...prev,
      isEnabled: false,
      lastStatus: 'idle',
    }));
  }, []);

  // トグル
  const toggleWarmup = useCallback(() => {
    if (status.isEnabled) {
      stopWarmup();
    } else {
      startWarmup();
    }
  }, [status.isEnabled, startWarmup, stopWarmup]);

  // 初期化時にlocalStorageから設定を復元
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'true') {
        console.log('[Warmup] Restoring warmup from localStorage');
        startWarmup();
      }
    } catch (e) {
      console.warn('[Warmup] Failed to read from localStorage:', e);
    }
  }, [startWarmup]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...status,
    startWarmup,
    stopWarmup,
    toggleWarmup,
    sendWarmupRequest,
  };
}
