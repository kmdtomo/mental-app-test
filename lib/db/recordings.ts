import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const DAILY_RECORDING_LIMIT = 5;

/**
 * その日の録音回数を取得
 */
export async function getTodayRecordingCount(userId: string): Promise<number> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const today = new Date().toISOString().split('T')[0];

  const { count, error } = await supabase
    .from('voice_recordings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);

  if (error) {
    console.error('Error getting recording count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * 録音可能かチェック
 */
export async function canRecord(userId: string): Promise<{ canRecord: boolean; remaining: number; used: number }> {
  const used = await getTodayRecordingCount(userId);
  const remaining = Math.max(0, DAILY_RECORDING_LIMIT - used);
  const canRecord = remaining > 0;

  return { canRecord, remaining, used };
}
