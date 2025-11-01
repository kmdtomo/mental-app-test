import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60秒タイムアウト
  maxRetries: 0, // 自前でリトライするので0に設定
});

export async function POST(request: NextRequest) {
  console.log('=== Whisper API Called ===');
  
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recordingId, filePath, duration } = await request.json();
    
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

    // Call Whisper API with retry logic
    console.log('Calling Whisper API...');
    let transcription;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'ja', // Japanese
          response_format: 'text',
        });
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.error(`Whisper API attempt ${retryCount} failed:`, error);

        if (retryCount >= maxRetries) {
          throw error; // Give up after max retries
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    const transcriptionText = transcription as unknown as string;
    console.log('Transcription completed:', transcriptionText.substring(0, 100) + '...');

    // Save to dialogue_turns table (ユーザー発言として保存)
    try {
      const { getNextOrderIndex } = await import('@/lib/db/dialogue');
      const { updateDailySummaryText } = await import('@/lib/db/dailySummary');

      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('Getting next order index for date:', date);

      const orderIndex = await getNextOrderIndex(user.id, date);
      console.log('Order index:', orderIndex);

      const { data: dialogueTurn, error: dbError } = await supabase
        .from('dialogue_turns')
        .insert({
          user_id: user.id,
          date: date,
          role: 'user',
          content: transcriptionText,
          input_type: 'voice',
          recording_id: recordingId,
          order_index: orderIndex
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error saving dialogue turn:', dbError);
        throw new Error(`DB Error: ${dbError.message}`);
      }

      console.log('Dialogue turn saved:', dialogueTurn.id);

      // daily_summariesのtranscription_textを更新
      console.log('Updating daily summary text...');
      await updateDailySummaryText(user.id, date);
      console.log('Daily summary text updated');

    } catch (dbSaveError) {
      console.error('Error in dialogue_turns save process:', dbSaveError);
      // エラーログを詳細に出力
      if (dbSaveError instanceof Error) {
        console.error('Error name:', dbSaveError.name);
        console.error('Error message:', dbSaveError.message);
        console.error('Error stack:', dbSaveError.stack);
      }
      // 保存エラーでも文字起こし結果は返す
    }

    // Use the actual duration if provided, otherwise estimate from file size
    const durationInSeconds = duration || Math.ceil(fileData.size / (128 * 1024 / 8));

    return NextResponse.json({
      success: true,
      originalText: transcriptionText,
      whisperDuration: durationInSeconds,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}