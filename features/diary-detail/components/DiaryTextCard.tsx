'use client';

import { Card } from '@/components/ui/Card';
import { Book, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DiaryTextCardProps {
  // transcription_textは使用しない - formatted_textのみを日記の要約として表示
  formattedText?: string;
  date: string;
}

export function DiaryTextCard({ formattedText, date }: DiaryTextCardProps) {
  // formatted_textを日記の要約として表示
  // AI要約前には要約が生成されていないことを確認
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '要約の生成に失敗しました');
      }

      // 成功したらページをリフレッシュ
      router.refresh();
    } catch (error) {
      console.error('Summary generation error:', error);
      alert(error instanceof Error ? error.message : '要約の生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="glass soft-shadow rounded-[20px] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full bg-primary/10">
          <Book className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">今日の日記</h2>
      </div>

      <div className="prose prose-sm max-w-none">
        {formattedText ? (
          <div className="text-foreground leading-relaxed whitespace-pre-wrap">
            {formattedText}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <p className="text-sm font-medium">AI要約がまだ生成されていません</p>
            <p className="text-xs">5回の対話を完了すると自動的に生成されます</p>
            <button
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  日記要約を生成
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
