import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DiaryChatPage } from '@/views/DiaryChatPage';
import { getTodayRecordingCount, DAILY_RECORDING_LIMIT } from '@/lib/db/recordings';

export const metadata = {
  title: 'AIとの対話 | メンタルアップテスト',
  description: 'AIと対話して今日の気持ちを整理しましょう'
};

export default async function DiaryChatRoute() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // 今日の録音回数を取得
  const usedCount = await getTodayRecordingCount(user.id);
  const remaining = Math.max(0, DAILY_RECORDING_LIMIT - usedCount);

  return (
    <DiaryChatPage
      user={user}
      recordingLimit={{
        used: usedCount,
        remaining: remaining,
        total: DAILY_RECORDING_LIMIT
      }}
    />
  );
}
