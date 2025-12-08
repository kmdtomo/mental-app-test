import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DiaryDetailWebPage } from '@/views/DiaryDetailWebPage';
import { getDailySummary } from '@/lib/db/dailySummary';

export const metadata = {
  title: '日記詳細 | メンタルアップテスト',
  description: '過去の日記と感情分析を振り返ります'
};

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/signin');
  }

  // URLパラメータから日付を取得（デフォルトは今日）
  const params = await searchParams;
  const date = params.date || new Date().toISOString().split('T')[0];

  // プロフィール情報を取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // ユーザー情報を整形
  const userData = {
    id: user.id,
    email: user.email || '',
    name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
    avatarUrl: profile?.avatar_url || null,
    createdAt: user.created_at || '',
  };

  // その日のサマリーを取得
  const summary = await getDailySummary(user.id, date);

  // その日の対話履歴を取得
  const { data: dialogueTurns } = await supabase
    .from('dialogue_turns')
    .select('role, content, created_at, input_type, recording_id')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('order_index', { ascending: true });

  // recording_idのリストを取得
  const recordingIds = (dialogueTurns || [])
    .filter(turn => turn.recording_id)
    .map(turn => turn.recording_id);

  // transcription_segmentsを取得（感情データ付き）
  // created_atとsegment_indexでソートして、録音ごとのセグメント順序を保持
  let transcriptionSegments: any[] = [];
  if (recordingIds.length > 0) {
    const { data: segments } = await supabase
      .from('transcription_segments')
      .select('id, recording_id, segment_index, text, start_time, end_time, arousal, valence, dominance, emotion_label, created_at')
      .in('recording_id', recordingIds)
      .order('created_at', { ascending: true })
      .order('segment_index', { ascending: true });

    transcriptionSegments = segments || [];
  }

  // 前後の日記がある日付を取得（ナビゲーション用）
  // 現在日付より前で最も新しい日付
  const { data: prevSummary } = await supabase
    .from('daily_summaries')
    .select('date')
    .eq('user_id', user.id)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  // 現在日付より後で最も古い日付
  const { data: nextSummary } = await supabase
    .from('daily_summaries')
    .select('date')
    .eq('user_id', user.id)
    .gt('date', date)
    .order('date', { ascending: true })
    .limit(1)
    .single();

  const adjacentDates = {
    prev: prevSummary?.date || null,
    next: nextSummary?.date || null,
  };

  return (
    <DiaryDetailWebPage
      user={userData}
      date={date}
      summary={summary}
      dialogueTurns={dialogueTurns || []}
      transcriptionSegments={transcriptionSegments}
      adjacentDates={adjacentDates}
    />
  );
}
