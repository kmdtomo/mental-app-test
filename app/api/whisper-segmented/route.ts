import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 0,
});

/**
 * 新しいWhisper API（セグメント単位）
 * Whisperのセグメント分割を使用してtranscription_segmentsに保存
 */
export async function POST(request: NextRequest) {
  console.log('=== Whisper Segmented API Called ===');

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recordingId, filePath } = await request.json();

    if (!recordingId || !filePath) {
      return NextResponse.json({ error: 'Missing recordingId or filePath' }, { status: 400 });
    }

    console.log('Processing recording:', { recordingId, filePath });

    // Download audio file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('voice-recordings')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return NextResponse.json({ error: downloadError.message }, { status: 500 });
    }

    console.log('File downloaded, size:', fileData.size);

    // Convert Blob to File for OpenAI
    const audioFile = new File([fileData], 'audio.webm', { type: 'audio/webm' });

    // Call Whisper API with segment-level timestamps
    console.log('Calling Whisper API with segment-level timestamps...');
    let transcription;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'ja',
          response_format: 'verbose_json',  // タイムスタンプ付き
          timestamp_granularities: ['segment'],  // セグメント単位（Whisperの自動分割）
        });
        break;
      } catch (error) {
        retryCount++;
        console.error(`Whisper API attempt ${retryCount} failed:`, error);

        if (retryCount >= maxRetries) {
          throw error;
        }

        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    console.log('Transcription completed with segments:', transcription.segments?.length || 0);

    // Whisperのセグメントをそのまま使用
    const segments = transcription.segments || [];
    console.log(`Using ${segments.length} segments from Whisper`);

    // セグメントをDBに保存
    if (segments && segments.length > 0) {
      const segmentsToInsert = segments.map((segment: any, index: number) => ({
        user_id: user.id,
        recording_id: recordingId,
        segment_index: index,
        text: segment.text.trim(),
        start_time: segment.start,
        end_time: segment.end,
      }));

      const { data: insertedSegments, error: insertError } = await supabase
        .from('transcription_segments')
        .insert(segmentsToInsert)
        .select();

      if (insertError) {
        console.error('Error inserting segments:', insertError);
        return NextResponse.json({ error: 'Failed to save segments' }, { status: 500 });
      }

      console.log(`Saved ${insertedSegments.length} segments to DB`);
    }

    // 全文テキストも生成（既存の互換性のため）
    const fullText = segments
      ?.map((seg: any) => seg.text.trim())
      .join('') || transcription.text || '';

    // dialogue_turnsにも保存（既存のフローとの互換性）
    const { getNextOrderIndex } = await import('@/lib/db/dialogue');
    const date = new Date().toISOString().split('T')[0];
    const orderIndex = await getNextOrderIndex(user.id, date);

    await supabase
      .from('dialogue_turns')
      .insert({
        user_id: user.id,
        date: date,
        role: 'user',
        content: fullText,
        input_type: 'voice',
        recording_id: recordingId,
        order_index: orderIndex
      });

    return NextResponse.json({
      success: true,
      text: fullText,
      segments: segments,
      segmentCount: segments.length,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
