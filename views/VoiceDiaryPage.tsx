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

interface VoiceDiaryPageProps {
  user?: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
}

export function VoiceDiaryPage({ user }: VoiceDiaryPageProps) {
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0); // seconds
  const [transcription, setTranscription] = useState<string>('');
  const [formattedText, setFormattedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    whisperDuration: number; // seconds
    claude: { input: number; output: number; total: number };
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
      
      // 2. Call Whisper API
      console.log('Step 2: Calling Whisper API...');
      const whisperResponse = await fetch('/api/whisper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: uploadResult.recordingId,
          filePath: uploadResult.filePath,
          duration: duration,
        }),
      });
      
      if (!whisperResponse.ok) {
        throw new Error('Whisper API failed');
      }
      
      const whisperData = await whisperResponse.json();
      console.log('Whisper result:', whisperData);
      setTranscription(whisperData.originalText);
      
      // 3. Call Claude 3.5 Sonnet for formatting
      console.log('Step 3: Calling Claude 3.5 Sonnet...');
      const formatResponse = await fetch('/api/format-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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