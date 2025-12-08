import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AIDialogueWebPage } from '@/views/AIDialogueWebPage';
import { getTodayRecordingCount, DAILY_RECORDING_LIMIT } from '@/lib/db/recordings';

export const metadata = {
  title: 'AIとの対話 | メンタルアップテスト',
  description: '音声でAIと対話し、あなたの気持ちを記録します'
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
    <AIDialogueWebPage
      user={userData}
      recordingLimit={{
        used: usedCount,
        remaining: remaining,
        total: DAILY_RECORDING_LIMIT
      }}
    />
  );
}
