import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardWebPage } from '@/views/DashboardWebPage';
import { getTodayRecordingCount, DAILY_RECORDING_LIMIT } from '@/lib/db/recordings';

export const metadata = {
  title: 'ダッシュボード | メンタルアップテスト',
  description: 'あなたの日記と感情の記録'
};

export default async function Page() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // プロフィール情報を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 過去90日分のサマリーを取得
  const { data: summaries } = await supabase
    .from('daily_summaries')
    .select('date, total_recordings, formatted_text')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(90);

  // 今日の日記があるかチェック
  const today = new Date().toISOString().split('T')[0];
  const hasTodayDiary = summaries?.some(s => s.date === today) || false;

  // 今日の録音回数を取得
  const usedCount = await getTodayRecordingCount(user.id);
  const remaining = Math.max(0, DAILY_RECORDING_LIMIT - usedCount);

  // ユーザー情報を整形
  const userData = {
    id: user.id,
    email: user.email || '',
    name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
    avatarUrl: profile?.avatar_url || null,
    createdAt: user.created_at || '',
  };

  return (
    <DashboardWebPage
      user={userData}
      summaries={summaries || []}
      hasTodayDiary={hasTodayDiary}
      recordingLimit={{
        used: usedCount,
        remaining: remaining,
        total: DAILY_RECORDING_LIMIT
      }}
    />
  );
}
