'use client';

import { useState } from 'react';
import { VoiceRecorder } from '@/features/voice-diary/components/VoiceRecorder';
import { UserHeader } from '@/features/voice-diary/components/UserHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Mic } from 'lucide-react';
import Link from 'next/link';
import {
  calculateWhisperCostUsd,
  calculateClaudeCostUsd,
  WHISPER_PRICE_PER_MIN_USD,
  CLAUDE_SONNET_INPUT_PER_M_TOKENS_USD,
  CLAUDE_SONNET_OUTPUT_PER_M_TOKENS_USD,
} from '@/lib/pricing';

// VAD値から感情を推定する関数（実データに基づく閾値）
function vadToEmotion(arousal: number, valence: number, dominance: number): string {
  // 実データの範囲: arousal(3.4-4.6), valence(3.6-4.5), dominance(3.4-4.5)
  // 中央値を基準とした相対的な判定

  const arousalMid = 4.0;
  const valenceMid = 4.0;
  const dominanceMid = 4.0;

  const arousalHigh = arousal > arousalMid;
  const valencHigh = valence > valenceMid;
  const dominanceHigh = dominance > dominanceMid;

  // より細かい閾値設定
  const arousalVeryHigh = arousal > 4.3;
  const arousalVeryLow = arousal < 3.7;
  const valenceVeryHigh = valence > 4.3;
  const valenceVeryLow = valence < 3.8;

  // 感情マッピング（優先度順）
  // 1. 高覚醒 + 高快度 = 興奮/幸せ
  if (arousalVeryHigh && valenceVeryHigh) return 'excited';
  if (arousalHigh && valencHigh) return 'happy';

  // 2. 高覚醒 + 低快度 = ストレス/怒り
  if (arousalVeryHigh && valenceVeryLow) return 'angry';
  if (arousalHigh && !valencHigh) return 'stressed';

  // 3. 低覚醒 + 高快度 = リラックス/穏やか
  if (arousalVeryLow && valencHigh) return 'calm';
  if (!arousalHigh && valenceVeryHigh) return 'relaxed';

  // 4. 低覚醒 + 低快度 = 疲労/悲しみ
  if (arousalVeryLow && valenceVeryLow) return 'sad';
  if (!arousalHigh && valenceVeryLow) return 'tired';

  // 5. 中間値 = 中立
  if (!arousalVeryHigh && !arousalVeryLow && !valenceVeryHigh && !valenceVeryLow) {
    return 'neutral';
  }

  // デフォルト：快度で判定
  if (valencHigh) return 'happy';
  if (valenceVeryLow) return 'sad';

  return 'neutral';
}

function getEmotionEmoji(emotion: string): string {
  const emojiMap: { [key: string]: string } = {
    'happy': '😊',
    'sad': '😢',
    'angry': '😠',
    'calm': '😌',
    'neutral': '😐',
    'excited': '🤩',
    'relaxed': '😎',
    'stressed': '😰',
    'tired': '😴'
  };
  return emojiMap[emotion] || '😐';
}

function getEmotionLabel(emotion: string): string {
  const labelMap: { [key: string]: string } = {
    'happy': '幸せ',
    'sad': '悲しみ',
    'angry': '怒り',
    'calm': '穏やか',
    'neutral': '中立',
    'excited': '興奮',
    'relaxed': 'リラックス',
    'stressed': 'ストレス',
    'tired': '疲労'
  };
  return labelMap[emotion] || '中立';
}

interface VoiceDiaryPageProps {
  user?: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
  recordingLimit?: {
    used: number;
    remaining: number;
    total: number;
  };
}

export function VoiceDiaryPage({ user, recordingLimit }: VoiceDiaryPageProps) {
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0); // seconds
  const [transcription, setTranscription] = useState<string>('');
  const [formattedText, setFormattedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    whisperDuration: number; // seconds
    claude: { input: number; output: number; total: number };
  } | null>(null);
  const [emotionResult, setEmotionResult] = useState<{
    file: string;
    segments: Array<{
      segment_id: number;
      start: number;
      end: number;
      duration: number;
      arousal: number;
      valence: number;
      dominance: number;
    }>;
    summary: {
      total_segments: number;
      avg_arousal: number;
      avg_valence: number;
      avg_dominance: number;
    };
  } | null>(null);

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    console.log('=== Recording Complete ===');
    console.log('Blob size:', blob.size, 'bytes');
    console.log('Blob type:', blob.type);
    console.log('Duration:', duration, 'seconds');
    
    setRecordingBlob(blob);
    setRecordingDuration(duration);
    setIsLoading(true);

    try {
      // 1. Upload to Supabase Storage
      console.log('Step 1: Uploading to Supabase Storage...');
      const { uploadAudio } = await import('@/features/voice-diary/actions/uploadAudio');
      const uploadResult = await uploadAudio(blob);
      console.log('Upload result:', uploadResult);
      
      // 2. Call NEW Whisper Segmented API (句読点分割)
      console.log('Step 2: Calling Whisper Segmented API...');
      const whisperResponse = await fetch('/api/whisper-segmented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recordingId: uploadResult.recordingId,
          filePath: uploadResult.filePath,
        }),
      });

      if (!whisperResponse.ok) {
        throw new Error('Whisper Segmented API failed');
      }

      const whisperData = await whisperResponse.json();
      console.log('Whisper Segmented result:', whisperData);
      setTranscription(whisperData.text);

      // 3. Call NEW Emotion Analysis Segmented API (セグメント単位)
      console.log('Step 3: Calling Emotion Analysis Segmented API...');
      const emotionResponse = await fetch('/api/analyze-emotion-segmented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recordingId: uploadResult.recordingId,
          filePath: uploadResult.filePath,
        }),
      });

      if (!emotionResponse.ok) {
        console.error('Emotion Segmented API failed:', await emotionResponse.text());
        // Continue even if emotion analysis fails
      }

      // Set emotion result if successful
      if (emotionResponse.ok) {
        const emotionData = await emotionResponse.json();
        console.log('Emotion Segmented result:', emotionData);
        setEmotionResult(emotionData);
      }

      // 3. Call Claude 3.5 Sonnet for formatting (コメントアウト)
      /*
      console.log('Step 3: Calling Claude 3.5 Sonnet...');
      const formatResponse = await fetch('/api/format-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transcriptionId: whisperData.transcriptionId,
          originalText: whisperData.originalText,
        }),
      });

      if (!formatResponse.ok) {
        throw new Error('Format API failed');
      }

      const formatData = await formatResponse.json();
      console.log('Format result:', formatData);
      setFormattedText(formatData.formattedText);

      // Set token usage
      setTokenUsage({
        whisperDuration: duration, // Use the actual recording duration
        claude: formatData.claudeTokens || { input: 0, output: 0, total: 0 }
      });
      */

      // Claude整形をスキップ（一時的にコメントアウト）
      console.log('Step 3: Claude formatting skipped (commented out)');
      setFormattedText(whisperData.originalText); // Whisperの結果をそのまま使用
      setTokenUsage({
        whisperDuration: duration,
        claude: { input: 0, output: 0, total: 0 }
      });
      
      console.log('=== Processing Complete ===');
    } catch (error) {
      console.error('Error processing recording:', error);
      setTranscription('エラーが発生しました');
      setFormattedText(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen panel">
      {user && <UserHeader user={user} />}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 上部ヒーローカード */}
          <div className="glass soft-shadow rounded-[24px] p-7 md:p-8">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                <Mic className="h-3.5 w-3.5" /> 今日の音声日記
              </span>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">気持ちを声にしてみましょう</h2>
              <p className="mt-1 text-sm text-muted-foreground">1分以内で気軽に話してみましょう</p>

              {/* 録音回数の残り表示 */}
              {recordingLimit && (
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                  <span className="text-xs font-medium">
                    今日の録音: {recordingLimit.used}/{recordingLimit.total}回
                  </span>
                  <span className="text-xs font-semibold text-primary">
                    残り{recordingLimit.remaining}回
                  </span>
                </div>
              )}
            </div>
            <div className="mt-6">
              <VoiceRecorder
                onRecordingComplete={handleRecordingComplete}
                maxDuration={60000}
              />
            </div>
          </div>

          {(transcription || formattedText) && (
            <Card className="p-6 rounded-[20px] soft-shadow">
              <div className="grid gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-accent/15 text-accent-foreground">Whisper</span>
                    <h3 className="font-semibold">文字起こし結果</h3>
                  </div>
                  <div className="p-4 rounded-xl bg-muted inner-soft min-h-[72px]">
                    {isLoading ? (
                      <p className="text-muted-foreground">処理中...</p>
                    ) : (
                      <p className="whitespace-pre-wrap">{transcription}</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">Claude</span>
                    <h3 className="font-semibold">整形後のテキスト</h3>
                  </div>
                  <div className="p-4 rounded-xl bg-muted inner-soft min-h-[72px]">
                    {isLoading ? (
                      <p className="text-muted-foreground">処理中...</p>
                    ) : (
                      <p className="whitespace-pre-wrap">{formattedText}</p>
                    )}
                  </div>
                </div>

                {/* Emotion Analysis Result */}
                {emotionResult && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-600">感情分析</span>
                      <h3 className="font-semibold">感情分析結果</h3>
                    </div>

                    {/* デバッグ用：データ構造を確認 */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                        <pre>{JSON.stringify(emotionResult, null, 2)}</pre>
                      </div>
                    )}

                    {/* 総評 */}
                    {emotionResult.summary && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 mb-4">
                        {(() => {
                          const avgArousal = emotionResult.summary.avg_arousal ?? 0;
                          const avgValence = emotionResult.summary.avg_valence ?? 0;
                          const avgDominance = emotionResult.summary.avg_dominance ?? 0;
                          const dominantEmotion = vadToEmotion(avgArousal, avgValence, avgDominance);

                          return (
                            <>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-lg">総評</h4>
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-white/60 dark:bg-black/20">
                                  {getEmotionEmoji(dominantEmotion)} {getEmotionLabel(dominantEmotion)}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                                <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/10">
                                  <span className="text-muted-foreground block text-xs">覚醒度</span>
                                  <p className="font-mono text-lg font-semibold">{avgArousal.toFixed(3)}</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/10">
                                  <span className="text-muted-foreground block text-xs">快度</span>
                                  <p className="font-mono text-lg font-semibold">{avgValence.toFixed(3)}</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-black/10">
                                  <span className="text-muted-foreground block text-xs">優位性</span>
                                  <p className="font-mono text-lg font-semibold">{avgDominance.toFixed(3)}</p>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                検出された発話区間: {emotionResult.summary.total_segments ?? 0}個
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* 各セグメントの詳細 */}
                    {emotionResult.segments && emotionResult.segments.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-muted-foreground">発話区間ごとの分析</h4>
                        {emotionResult.segments.map((segment) => {
                          const arousal = segment.arousal ?? 0;
                          const valence = segment.valence ?? 0;
                          const dominance = segment.dominance ?? 0;
                          const segmentEmotion = vadToEmotion(arousal, valence, dominance);

                          return (
                            <div
                              key={segment.segment_id}
                              className="p-3 rounded-lg bg-muted inner-soft"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  区間 {segment.segment_id}: {(segment.start ?? 0).toFixed(1)}秒 - {(segment.end ?? 0).toFixed(1)}秒 ({(segment.duration ?? 0).toFixed(1)}秒)
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                                  {getEmotionEmoji(segmentEmotion)} {getEmotionLabel(segmentEmotion)}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">覚醒度:</span>
                                  <p className="font-mono">{arousal.toFixed(3)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">快度:</span>
                                  <p className="font-mono">{valence.toFixed(3)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">優位性:</span>
                                  <p className="font-mono">{dominance.toFixed(3)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {recordingBlob && (
                  <div className="pt-4 border-t">
                    <audio 
                      controls 
                      src={URL.createObjectURL(recordingBlob)}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Token Usage Display */}
                {tokenUsage && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="mb-2 text-sm font-medium">使用量・料金</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Whisper:</span>
                          <span className="font-mono">{tokenUsage.whisperDuration}秒</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">料金:</span>
                          <span className="text-xs font-mono">${calculateWhisperCostUsd(tokenUsage.whisperDuration).toFixed(4)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Claude:</span>
                          <span className="font-mono">{tokenUsage.claude.total.toLocaleString()} tokens</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">料金:</span>
                          <span className="text-xs font-mono">${calculateClaudeCostUsd(tokenUsage.claude.input, tokenUsage.claude.output).toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-muted rounded-md">
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>合計料金:</span>
                        <span className="font-mono">
                          ${(
                            calculateWhisperCostUsd(tokenUsage.whisperDuration) +
                            calculateClaudeCostUsd(tokenUsage.claude.input, tokenUsage.claude.output)
                          ).toFixed(4)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <div>Whisper: ${WHISPER_PRICE_PER_MIN_USD}/分（録音時間に基づく）</div>
                        <div>Claude 3.5 Sonnet: 入力 ${CLAUDE_SONNET_INPUT_PER_M_TOKENS_USD}/1M tokens, 出力 ${CLAUDE_SONNET_OUTPUT_PER_M_TOKENS_USD}/1M tokens</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}