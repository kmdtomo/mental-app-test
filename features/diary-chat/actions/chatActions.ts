'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getNextOrderIndex } from '@/lib/db/dialogue';

/**
 * ユーザーメッセージを保存
 */
export async function saveUserMessage(
  content: string,
  inputType: 'text' | 'voice',
  recordingId?: string
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  const date = new Date().toISOString().split('T')[0];
  const orderIndex = await getNextOrderIndex(user.id, date);

  const { error } = await supabase.from('dialogue_turns').insert({
    user_id: user.id,
    date: date,
    role: 'user',
    content: content,
    input_type: inputType,
    recording_id: recordingId || null,
    order_index: orderIndex
  });

  if (error) {
    console.error('Error saving user message:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * AIメッセージを保存（将来実装）
 */
export async function saveAIMessage(
  content: string
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  const date = new Date().toISOString().split('T')[0];
  const orderIndex = await getNextOrderIndex(user.id, date);

  const { error } = await supabase.from('dialogue_turns').insert({
    user_id: user.id,
    date: date,
    role: 'assistant',
    content: content,
    input_type: null,
    recording_id: null,
    order_index: orderIndex
  });

  if (error) {
    console.error('Error saving AI message:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * その日の対話履歴を感情データ付きで取得
 */
export async function getTodayDialogue(): Promise<{
  success: boolean;
  messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    segments?: Array<{
      id: string;
      text: string;
      start_time: number;
      end_time: number;
      emotion_label: string | null;
      arousal: number | null;
      valence: number | null;
      dominance: number | null;
    }>;
    emotionData?: {
      segments: any[];
      total_segments: number;
      avg_arousal: number;
      avg_valence: number;
      avg_dominance: number;
    };
  }>;
  error?: string;
}> {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  const date = new Date().toISOString().split('T')[0];

  // まずdialogue_turnsを取得
  const { data: turns, error } = await supabase
    .from('dialogue_turns')
    .select('role, content, created_at, input_type, recording_id')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error getting dialogue:', error);
    return { success: false, error: error.message };
  }

  // 各ターンのセグメントデータを取得
  const messages = await Promise.all(
    turns?.map(async (turn) => {
      let segments = undefined;
      let emotionData = undefined;

      // ユーザーの音声入力で、recording_idがある場合のみ
      if (turn.role === 'user' && turn.recording_id) {
        // transcription_segmentsから取得
        const { data: transcriptionSegments, error: segmentsError } = await supabase
          .from('transcription_segments')
          .select('id, text, start_time, end_time, emotion_label, arousal, valence, dominance')
          .eq('recording_id', turn.recording_id)
          .order('segment_index', { ascending: true });

        if (transcriptionSegments && !segmentsError && transcriptionSegments.length > 0) {
          segments = transcriptionSegments;

          // 平均VAD値を計算
          const validSegments = transcriptionSegments.filter(
            s => s.arousal !== null && s.valence !== null && s.dominance !== null
          );

          if (validSegments.length > 0) {
            emotionData = {
              segments: transcriptionSegments,
              total_segments: transcriptionSegments.length,
              avg_arousal: validSegments.reduce((sum, s) => sum + s.arousal!, 0) / validSegments.length,
              avg_valence: validSegments.reduce((sum, s) => sum + s.valence!, 0) / validSegments.length,
              avg_dominance: validSegments.reduce((sum, s) => sum + s.dominance!, 0) / validSegments.length,
            };
          }
        }
      }

      return {
        role: turn.role as 'user' | 'assistant',
        content: turn.content,
        timestamp: turn.created_at,
        segments: segments,
        emotionData: emotionData
      };
    }) || []
  );

  return { success: true, messages };
}
