import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { calculateDailyEmotionStats } from './emotionAnalysis';
import { getDailyTranscriptionText } from './dialogue';

export interface DailySummary {
  id: string;
  user_id: string;
  date: string;
  transcription_text: string | null;
  formatted_text: string | null;
  avg_arousal: number | null;
  avg_valence: number | null;
  avg_dominance: number | null;
  dominant_emotion: string | null;
  emotion_distribution: { [key: string]: number };
  total_recordings: number;
  total_duration_seconds: number;
  ai_insights: string | null;
  created_at: string;
  updated_at: string;
}

export type DailySummaryUpsert = Partial<Omit<DailySummary, 'id' | 'created_at' | 'updated_at'>> & {
  user_id: string;
  date: string;
};

/**
 * daily_summariesを作成または更新（upsert）
 */
export async function upsertDailySummary(data: DailySummaryUpsert): Promise<{ success: boolean; error?: string }> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase
    .from('daily_summaries')
    .upsert(data, {
      onConflict: 'user_id,date'
    });

  if (error) {
    console.error('Error upserting daily summary:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * その日の感情データを再計算してdaily_summariesを更新
 */
export async function updateDailySummaryEmotions(userId: string, date: string): Promise<void> {
  const stats = await calculateDailyEmotionStats(userId, date);

  if (!stats) {
    console.log('No emotion data for date:', date);
    return;
  }

  await upsertDailySummary({
    user_id: userId,
    date: date,
    avg_arousal: stats.avgArousal,
    avg_valence: stats.avgValence,
    avg_dominance: stats.avgDominance,
    dominant_emotion: stats.dominantEmotion,
    emotion_distribution: stats.emotionDistribution,
    total_recordings: stats.totalRecordings
  });
}

/**
 * その日の文字起こしテキストを再計算してdaily_summariesを更新
 */
export async function updateDailySummaryText(userId: string, date: string): Promise<void> {
  const transcriptionText = await getDailyTranscriptionText(userId, date);

  await upsertDailySummary({
    user_id: userId,
    date: date,
    transcription_text: transcriptionText
  });
}

/**
 * その日のdaily_summaryを取得
 */
export async function getDailySummary(userId: string, date: string): Promise<DailySummary | null> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) {
    console.error('Error getting daily summary:', error);
    return null;
  }

  return data;
}

/**
 * ユーザーの全サマリーを取得（日付降順）
 */
export async function getUserDailySummaries(
  userId: string,
  limit = 30
): Promise<DailySummary[]> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting user summaries:', error);
    return [];
  }

  return data || [];
}

/**
 * AI insightsを更新
 */
export async function updateAiInsights(
  userId: string,
  date: string,
  insights: string
): Promise<{ success: boolean; error?: string }> {
  return await upsertDailySummary({
    user_id: userId,
    date: date,
    ai_insights: insights
  });
}

/**
 * その日の録音総時間を計算して更新
 */
export async function updateTotalDuration(userId: string, date: string): Promise<void> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  // その日の全録音の合計時間を計算
  const { data: recordings } = await supabase
    .from('voice_recordings')
    .select('duration')
    .eq('user_id', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`);

  const totalDuration = recordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;

  await upsertDailySummary({
    user_id: userId,
    date: date,
    total_duration_seconds: totalDuration
  });
}
