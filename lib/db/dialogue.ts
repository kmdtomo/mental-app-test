import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export interface DialogueTurn {
  id: string;
  user_id: string;
  date: string;
  role: 'user' | 'assistant';
  content: string;
  input_type: 'text' | 'voice' | null;
  recording_id: string | null;
  order_index: number;
  created_at: string;
}

export type DialogueTurnInsert = Omit<DialogueTurn, 'id' | 'created_at'>;

/**
 * その日の次のorder_indexを取得
 */
export async function getNextOrderIndex(userId: string, date: string): Promise<number> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('dialogue_turns')
    .select('order_index')
    .eq('user_id', userId)
    .eq('date', date)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error getting next order index:', error);
    return 1;
  }

  return (data?.order_index || 0) + 1;
}

/**
 * dialogue_turnを保存
 */
export async function saveDialogueTurn(turn: DialogueTurnInsert): Promise<{ success: boolean; id?: string; error?: string }> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('dialogue_turns')
    .insert(turn)
    .select()
    .single();

  if (error) {
    console.error('Error saving dialogue turn:', error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * その日の全対話履歴を取得（OpenAI API用）
 */
export async function getDialogueHistory(
  userId: string,
  date: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('dialogue_turns')
    .select('role, content')
    .eq('user_id', userId)
    .eq('date', date)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error getting dialogue history:', error);
    return [];
  }

  return data || [];
}

/**
 * 音声録音に紐付く文字起こし（dialogue_turn）を取得
 */
export async function getTranscriptionByRecordingId(recordingId: string): Promise<string | null> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('dialogue_turns')
    .select('content')
    .eq('recording_id', recordingId)
    .eq('role', 'user')
    .eq('input_type', 'voice')
    .maybeSingle();

  if (error) {
    console.error('Error getting transcription:', error);
    return null;
  }

  return data?.content || null;
}

/**
 * その日の全ユーザー発言を結合して取得
 */
export async function getDailyTranscriptionText(userId: string, date: string): Promise<string> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from('dialogue_turns')
    .select('content')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('role', 'user')
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error getting daily transcription:', error);
    return '';
  }

  return data?.map(t => t.content).join(' ') || '';
}
