import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  console.log('=== Emotion Analysis API Called ===');
  
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
    
    // Supabaseから音声ファイルをダウンロード（サーバーサイドで実行）
    const { data, error: downloadError } = await supabase.storage
      .from('voice-recordings')
      .download(filePath);
    
    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download audio file: ${downloadError.message}`);
    }
    
    // Blobをバッファに変換
    const buffer = Buffer.from(await data.arrayBuffer());
    
    // 一時ファイルとして保存
    const tempDir = '/tmp';
    const tempWavPath = path.join(tempDir, `audio_${recordingId}.wav`);
    
    // WAVファイルを書き込み（既にWAV形式なので変換不要）
    await fs.writeFile(tempWavPath, buffer);
    console.log(`Saved WAV file: ${tempWavPath} (${buffer.length} bytes)`);
    
    // Python感情分析実行
    try {
      // Pythonスクリプトを一時ファイルに書き込む
      const scriptPath = path.join(tempDir, `emotion_analysis_${recordingId}.py`);
      const pythonScript = `
import sys
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')
import librosa
import soundfile as sf
from inference import inference_core
import json
import os

# 入力ファイルパス
temp_wav = '${tempWavPath}'

try:
    # WAVファイルは既に正しい形式なので、そのまま使用
    print(f"Using WAV file: {temp_wav}")
    
    # 感情分析実行
    print("Running emotion analysis...")
    result = inference_core(temp_wav)
    
    if result:
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Analysis failed"}))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
finally:
    # 一時ファイル削除
    try:
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
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
          }
        }
      );
      
      if (stderr) {
        console.error('Python stderr:', stderr);
      }
      
      console.log('Python stdout:', stdout);
      
      // 出力から警告を除外してJSONをパース
      const lines = stdout.split('\n');
      const jsonLine = lines.find(line => line.startsWith('{'));
      
      if (!jsonLine) {
        throw new Error('No JSON output from Python script');
      }
      
      const emotionResult = JSON.parse(jsonLine);
      console.log('Emotion result:', emotionResult);
      
      // エラーチェック
      if (emotionResult.error) {
        throw new Error(`Emotion analysis error: ${emotionResult.error}`);
      }
      
      // クリーンアップ
      await Promise.all([
        fs.unlink(scriptPath).catch(() => {}),
        fs.unlink(tempWavPath).catch(() => {})
      ]);
      
      return NextResponse.json({
        success: true,
        emotion: emotionResult
      });
      
    } catch (error) {
      console.error('Python execution error:', error);
      // クリーンアップ
      await Promise.all([
        fs.unlink(tempWavPath).catch(() => {})
      ]);
      throw error;
    }
    
  } catch (error) {
    console.error('Emotion analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}