'use client';

import { Button } from '@/components/ui/Button';
import { MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// ============================================================
// DiaryCTA Component
// ============================================================

interface DiaryCTAProps {
  hasTodayDiary?: boolean;
  recordingLimit?: {
    used: number;
    remaining: number;
    total: number;
  };
}

export function DiaryCTA({ hasTodayDiary = false, recordingLimit }: DiaryCTAProps) {
  const router = useRouter();

  return (
    <div className="glass soft-shadow rounded-[24px] p-8 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary mb-3">
        <MessageCircle className="h-3.5 w-3.5" />
        今日の日記
      </div>

      <h2 className="text-2xl font-semibold mb-2">
        {hasTodayDiary ? '今日の日記を続けましょう' : '今日の気持ちを記録しましょう'}
      </h2>

      <p className="text-sm text-muted-foreground mb-2">
        AIがあなたの本音を引き出すお手伝いをします
      </p>

      {/* 録音回数の残り表示 */}
      {recordingLimit && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted mb-4">
          <span className="text-xs font-medium">
            今日の録音: {recordingLimit.used}/{recordingLimit.total}回
          </span>
          <span className={`text-xs font-semibold ${recordingLimit.remaining > 0 ? 'text-primary' : 'text-destructive'}`}>
            残り{recordingLimit.remaining}回
          </span>
        </div>
      )}

      <div>
        <Button
          onClick={() => router.push('/diary-chat')}
          size="lg"
          className="rounded-full px-8"
          disabled={recordingLimit?.remaining === 0}
        >
          {hasTodayDiary ? '✏️ 今日の日記を続ける' : '📝 今日の日記を入力する'}
        </Button>
        {recordingLimit?.remaining === 0 && (
          <p className="text-xs text-destructive mt-2">今日の録音制限に達しました</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DiaryCalendar Component
// ============================================================

interface DiaryEntry {
  date: string;
  dominant_emotion: string | null;
  total_recordings: number;
}

interface DiaryCalendarProps {
  entries: DiaryEntry[];
}

export function DiaryCalendar({ entries }: DiaryCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());

  const entryMap = new Map(entries.map(e => [e.date, e]));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days = [];
  const startingDayOfWeek = firstDay.getDay();

  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(day);
  }

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = entryMap.get(dateStr);

    if (entry) {
      router.push(`/diary/${dateStr}`);
    }
  };

  const getEmotionColor = (emotion: string | null): string => {
    if (!emotion) return 'bg-muted';

    const colorMap: { [key: string]: string } = {
      'happy': 'bg-green-100 dark:bg-green-900/30 border-green-300',
      'excited': 'bg-green-100 dark:bg-green-900/30 border-green-300',
      'sad': 'bg-blue-100 dark:bg-blue-900/30 border-blue-300',
      'tired': 'bg-blue-100 dark:bg-blue-900/30 border-blue-300',
      'angry': 'bg-red-100 dark:bg-red-900/30 border-red-300',
      'stressed': 'bg-orange-100 dark:bg-orange-900/30 border-orange-300',
      'calm': 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300',
      'relaxed': 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300',
      'neutral': 'bg-gray-100 dark:bg-gray-800 border-gray-300'
    };

    return colorMap[emotion] || 'bg-muted';
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return today.getFullYear() === year &&
           today.getMonth() === month &&
           today.getDate() === day;
  };

  return (
    <div className="glass soft-shadow rounded-[24px] p-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={previousMonth}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold">
          {year}年{month + 1}月
        </h3>

        <button
          onClick={nextMonth}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
          <div key={i} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entry = entryMap.get(dateStr);
          const hasEntry = !!entry;
          const todayClass = isToday(day);

          return (
            <button
              key={day}
              onClick={() => hasEntry && handleDateClick(day)}
              disabled={!hasEntry}
              className={`
                aspect-square rounded-lg flex items-center justify-center text-sm font-medium
                transition-all relative
                ${todayClass ? 'ring-2 ring-primary ring-offset-2' : ''}
                ${hasEntry
                  ? `${getEmotionColor(entry.dominant_emotion)} cursor-pointer hover:scale-105 hover:shadow-md border`
                  : 'text-muted-foreground cursor-default'
                }
              `}
            >
              {day}
              {hasEntry && (
                <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-muted-foreground mb-2">感情の色分け:</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300" />
            <span>幸せ/興奮</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300" />
            <span>悲しみ/疲労</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300" />
            <span>怒り</span>
          </div>
        </div>
      </div>
    </div>
  );
}
