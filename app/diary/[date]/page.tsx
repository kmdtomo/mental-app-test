import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DiaryDetailPage } from '@/views/DiaryDetailPage';

export async function generateMetadata({ params }: { params: { date: string } }) {
  return {
    title: `${params.date}の日記 | メンタルアップテスト`,
    description: `${params.date}の感情分析と日記`
  };
}

export default async function DiaryDetail({ params }: { params: { date: string } }) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // その日のサマリーを取得
  const { data: summary } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', params.date)
    .maybeSingle();

  // その日の対話履歴を取得
  const { data: dialogueTurns } = await supabase
    .from('dialogue_turns')
    .select('role, content, created_at, input_type')
    .eq('user_id', user.id)
    .eq('date', params.date)
    .order('order_index', { ascending: true });

  return (
    <DiaryDetailPage
      user={user}
      date={params.date}
      summary={summary}
      dialogueTurns={dialogueTurns || []}
    />
  );
}
