import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  console.log('=== Emotion Analysis API Called (Alternative) ===');
  
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recordingId, filePath } = await request.json();
    console.log('Processing:', { recordingId, filePath });
    
    // Method 1: Try server-side download first
    const { data, error: downloadError } = await supabase.storage
      .from('voice-recordings')
      .download(filePath);
    
    if (downloadError) {
      console.error('Download error:', downloadError);
      
      // Method 2: If download fails, try getting a signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('voice-recordings')
        .createSignedUrl(filePath, 60); // 60 seconds expiry
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to get signed URL: ${signedUrlError?.message}`);
      }
      
      console.log('Using signed URL approach');
      
      // Download using fetch
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      return processAudioWithEmotion(buffer, recordingId);
    }
    
    // If direct download worked, process the audio
    const buffer = Buffer.from(await data.arrayBuffer());
    return processAudioWithEmotion(buffer, recordingId);
    
  } catch (error) {
    console.error('Emotion analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

async function processAudioWithEmotion(buffer: Buffer, recordingId: string) {
  const tempDir = '/tmp';
  const tempWebmPath = path.join(tempDir, `audio_${recordingId}.webm`);
  const tempWavPath = path.join(tempDir, `audio_${recordingId}.wav`);
  const scriptPath = path.join(tempDir, `emotion_analysis_${recordingId}.py`);
  
  try {
    // WebMファイルを書き込み
    await fs.writeFile(tempWebmPath, buffer);
    console.log(`Saved WebM file: ${tempWebmPath} (${buffer.length} bytes)`);
    
    // より堅牢なPythonスクリプト
    const pythonScript = `
import sys
import os
import json
import traceback

# Add path
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

# 入力ファイルパス
temp_webm = '${tempWebmPath}'
temp_wav = '${tempWavPath}'

try:
    # Try multiple audio loading methods
    audio_loaded = False
    
    # Method 1: Try librosa
    try:
        import librosa
        import soundfile as sf
        print(f"Loading audio with librosa from: {temp_webm}")
        audio_data, sr = librosa.load(temp_webm, sr=16000, mono=True)
        audio_loaded = True
        print(f"Audio loaded with librosa: {len(audio_data)} samples at {sr}Hz")
    except Exception as e:
        print(f"Librosa failed: {e}")
        
    # Method 2: Try ffmpeg conversion if librosa failed
    if not audio_loaded:
        try:
            import subprocess
            print("Trying ffmpeg conversion...")
            cmd = ['ffmpeg', '-i', temp_webm, '-ar', '16000', '-ac', '1', '-y', temp_wav]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                # Load the converted file
                audio_data, sr = librosa.load(temp_wav, sr=16000)
                audio_loaded = True
                print(f"Audio converted and loaded: {len(audio_data)} samples at {sr}Hz")
            else:
                print(f"FFmpeg failed: {result.stderr}")
        except Exception as e:
            print(f"FFmpeg conversion failed: {e}")
    
    if not audio_loaded:
        raise Exception("Could not load audio file with any method")
    
    # Save as WAV if not already done
    if not os.path.exists(temp_wav):
        sf.write(temp_wav, audio_data, sr)
        print(f"Saved WAV file: {temp_wav}")
    
    # Import and run emotion analysis
    from inference import inference_core
    
    # Check if the inference module needs device setting
    try:
        import torch
        if not torch.cuda.is_available():
            import inference
            inference.device = "cpu"
            print("Set device to CPU")
    except:
        pass
    
    print("Running emotion analysis...")
    result = inference_core(temp_wav)
    
    if result:
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Analysis returned no result"}))
        
except Exception as e:
    error_info = {
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc()
    }
    print(json.dumps(error_info))
finally:
    # Cleanup
    for f in [temp_wav]:
        try:
            if os.path.exists(f):
                os.remove(f)
        except:
            pass
`;
    
    await fs.writeFile(scriptPath, pythonScript);
    
    console.log('Executing Python script...');
    const { stdout, stderr } = await execAsync(
      `cd /Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning && python3 ${scriptPath}`,
      {
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1',
        },
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }
    );
    
    if (stderr) {
      console.error('Python stderr:', stderr);
    }
    
    console.log('Python stdout:', stdout);
    
    // Parse JSON output
    const lines = stdout.split('\n').filter(line => line.trim());
    let emotionResult = null;
    
    // Try to find JSON from the end (most recent output)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.startsWith('{')) {
        try {
          emotionResult = JSON.parse(line);
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!emotionResult) {
      throw new Error('No valid JSON output from Python script');
    }
    
    console.log('Emotion result:', emotionResult);
    
    // Check for errors
    if (emotionResult.error) {
      console.error('Emotion analysis error details:', emotionResult);
      throw new Error(`Emotion analysis failed: ${emotionResult.error}`);
    }
    
    return NextResponse.json({
      success: true,
      emotion: emotionResult
    });
    
  } finally {
    // Always cleanup
    await Promise.all([
      fs.unlink(scriptPath).catch(() => {}),
      fs.unlink(tempWebmPath).catch(() => {}),
      fs.unlink(tempWavPath).catch(() => {})
    ]);
  }
}