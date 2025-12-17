import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * 最後の1ラリー（user + assistant）を削除するAPI
 * - dialogue_turns: user, assistantの両方
 * - transcription_segments: recording_idに紐付くセグメント
 * - voice_recordings: 音声ファイル
 * - Supabase Storage: 実際の音声ファイル
 */
export async function DELETE(request: NextRequest) {
  console.log('=== Delete Last Turn API Called ===');

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. 今日の最新のユーザー発言を取得（recording_id付き）
    const { data: lastUserTurn, error: userTurnError } = await supabase
      .from('dialogue_turns')
      .select('id, recording_id, order_index, created_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('role', 'user')
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    if (userTurnError || !lastUserTurn) {
      console.log('No user turn found to delete');
      return NextResponse.json({ error: 'No user turn found to delete' }, { status: 404 });
    }

    console.log('Found last user turn:', lastUserTurn);

    const recordingId = lastUserTurn.recording_id;
    const userOrderIndex = lastUserTurn.order_index;

    // 2. 対応するassistant発言を取得（userの直後）
    const { data: lastAssistantTurn } = await supabase
      .from('dialogue_turns')
      .select('id, order_index')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('role', 'assistant')
      .gt('order_index', userOrderIndex)
      .order('order_index', { ascending: true })
      .limit(1)
      .single();

    console.log('Found assistant turn:', lastAssistantTurn);

    // 3. transcription_segmentsを削除
    if (recordingId) {
      const { error: segmentsError } = await supabase
        .from('transcription_segments')
        .delete()
        .eq('recording_id', recordingId);

      if (segmentsError) {
        console.error('Error deleting transcription_segments:', segmentsError);
      } else {
        console.log('Deleted transcription_segments for recording:', recordingId);
      }
    }

    // 4. voice_recordingsのファイルパスを先に取得（後で削除するため）
    let voiceRecordingFilePath: string | null = null;
    if (recordingId) {
      console.log('Looking for voice_recording with id:', recordingId);

      const { data: voiceRecording, error: vrError } = await supabase
        .from('voice_recordings')
        .select('file_path')
        .eq('id', recordingId)
        .single();

      console.log('voice_recording query result:', { voiceRecording, vrError });

      if (voiceRecording && voiceRecording.file_path) {
        voiceRecordingFilePath = voiceRecording.file_path;
      }
    }

    // 5. dialogue_turnsを削除（user）- voice_recordingsより先に削除（CHECK制約対策）
    const { error: userDeleteError } = await supabase
      .from('dialogue_turns')
      .delete()
      .eq('id', lastUserTurn.id);

    if (userDeleteError) {
      console.error('Error deleting user turn:', userDeleteError);
    } else {
      console.log('Deleted user turn:', lastUserTurn.id);
    }

    // 6. dialogue_turnsを削除（assistant）
    if (lastAssistantTurn) {
      const { error: assistantDeleteError } = await supabase
        .from('dialogue_turns')
        .delete()
        .eq('id', lastAssistantTurn.id);

      if (assistantDeleteError) {
        console.error('Error deleting assistant turn:', assistantDeleteError);
      } else {
        console.log('Deleted assistant turn:', lastAssistantTurn.id);
      }
    }

    // 7. voice_recordingsを削除（dialogue_turns削除後に実行）
    if (recordingId) {
      // Storageからファイルを削除
      if (voiceRecordingFilePath) {
        const { error: storageError } = await supabase.storage
          .from('voice-recordings')
          .remove([voiceRecordingFilePath]);

        if (storageError) {
          console.error('Error deleting storage file:', storageError);
        } else {
          console.log('Deleted storage file:', voiceRecordingFilePath);
        }
      }

      // voice_recordingsテーブルから削除
      const { error: vrDeleteError } = await supabase
        .from('voice_recordings')
        .delete()
        .eq('id', recordingId);

      if (vrDeleteError) {
        console.error('Error deleting voice_recording:', vrDeleteError);
      } else {
        console.log('Deleted voice_recording:', recordingId);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: {
        userTurnId: lastUserTurn.id,
        assistantTurnId: lastAssistantTurn?.id || null,
        recordingId: recordingId,
      }
    });

  } catch (error) {
    console.error('Delete last turn error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
