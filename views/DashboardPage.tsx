'use client';

import { useState, useEffect } from 'react';
import { DiaryCTA, DiaryCalendar } from '@/features/dashboard/components';
import { UserHeader } from '@/features/voice-diary/components/UserHeader';

interface DiaryEntry {
  date: string;
  dominant_emotion: string | null;
  total_recordings: number;
}

interface DashboardPageProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
  initialEntries: DiaryEntry[];
  hasTodayDiary: boolean;
  recordingLimit: {
    used: number;
    remaining: number;
    total: number;
  };
}

export function DashboardPage({ user, initialEntries, hasTodayDiary, recordingLimit }: DashboardPageProps) {
  const [entries] = useState<DiaryEntry[]>(initialEntries);

  return (
    <div className="min-h-screen panel">
      <UserHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 今日の日記入力CTA */}
          <DiaryCTA hasTodayDiary={hasTodayDiary} recordingLimit={recordingLimit} />

          {/* カレンダー */}
          <DiaryCalendar entries={entries} />
        </div>
      </div>
    </div>
  );
}
