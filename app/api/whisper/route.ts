import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

    // Call Whisper API
    console.log('Calling Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ja', // Japanese
      response_format: 'text',
    });

    const transcriptionText = transcription as unknown as string;
    console.log('Transcription completed:', transcriptionText.substring(0, 100) + '...');

    // Save to transcriptions table
    const { data: transcriptionRecord, error: dbError } = await supabase
      .from('transcriptions')
      .insert({
        user_id: user.id,
        recording_id: recordingId,
        original_text: transcriptionText,
        formatted_text: '', // Will be filled by Claude later
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    console.log('Transcription saved:', transcriptionRecord.id);

    // Use the actual duration if provided, otherwise estimate from file size
    const durationInSeconds = duration || Math.ceil(fileData.size / (128 * 1024 / 8));
    
    return NextResponse.json({
      success: true,
      transcriptionId: transcriptionRecord.id,
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