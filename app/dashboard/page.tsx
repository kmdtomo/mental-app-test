import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardPage } from '@/views/DashboardPage';
import { getTodayRecordingCount, DAILY_RECORDING_LIMIT } from '@/lib/db/recordings';

export const metadata = {
  title: 'ダッシュボード | メンタルアップテスト',
  description: 'あなたの日記と感情の記録'
};

export default async function Dashboard() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // 過去90日分のサマリーを取得
  const { data: summaries } = await supabase
    .from('daily_summaries')
    .select('date, dominant_emotion, total_recordings')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(90);

  // 今日の日記があるかチェック
  const today = new Date().toISOString().split('T')[0];
  const hasTodayDiary = summaries?.some(s => s.date === today) || false;

  // 今日の録音回数を取得
  const usedCount = await getTodayRecordingCount(user.id);
  const remaining = Math.max(0, DAILY_RECORDING_LIMIT - usedCount);

  return (
    <DashboardPage
      user={user}
      initialEntries={summaries || []}
      hasTodayDiary={hasTodayDiary}
      recordingLimit={{
        used: usedCount,
        remaining: remaining,
        total: DAILY_RECORDING_LIMIT
      }}
    />
  );
}
