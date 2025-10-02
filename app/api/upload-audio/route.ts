import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('=== Upload Audio API Called ===');
  
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('User authenticated:', user.id);

    // Get form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const turnNumber = formData.get('turnNumber') as string || '1';
    const dialogueId = formData.get('dialogueId') as string || null;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }
    
    console.log('Audio file received:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    // Create unique filename
    const timestamp = Date.now();
    const fileName = `${user.id}/${timestamp}_${turnNumber}.wav`; // WAV format
    console.log('Saving as:', fileName);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice-recordings')
      .upload(fileName, audioFile, {
        contentType: audioFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    console.log('File uploaded successfully:', uploadData.path);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('voice-recordings')
      .getPublicUrl(fileName);

    // Save to voice_recordings table
    const { data: recording, error: dbError } = await supabase
      .from('voice_recordings')
      .insert({
        user_id: user.id,
        file_path: fileName,
        duration: 0, // Will be updated later
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }
    console.log('Database record created:', recording.id);

    return NextResponse.json({
      success: true,
      recordingId: recording.id,
      filePath: fileName,
      publicUrl
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}