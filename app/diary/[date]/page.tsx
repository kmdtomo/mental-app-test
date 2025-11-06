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
  const { data: rawTurns } = await supabase
    .from('dialogue_turns')
    .select('role, content, created_at, input_type, recording_id')
    .eq('user_id', user.id)
    .eq('date', params.date)
    .order('order_index', { ascending: true });

  // 各ターンの感情データを個別に取得
  const dialogueTurns = await Promise.all(
    rawTurns?.map(async (turn) => {
      let emotionData = undefined;

      if (turn.role === 'user' && turn.recording_id) {
        const { data: emotion } = await supabase
          .from('emotion_analysis_results')
          .select('segments, total_segments, avg_arousal, avg_valence, avg_dominance')
          .eq('recording_id', turn.recording_id)
          .maybeSingle();

        if (emotion) {
          emotionData = {
            emotion_analysis_results: [emotion]
          };
        }
      }

      return {
        ...turn,
        voice_recordings: emotionData ? [emotionData] : undefined
      };
    }) || []
  );

  return (
    <DiaryDetailPage
      user={user}
      date={params.date}
      summary={summary}
      dialogueTurns={dialogueTurns || []}
    />
  );
}
