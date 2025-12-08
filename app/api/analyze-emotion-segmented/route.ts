import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getEmotionFromVAD } from '@/lib/emotionLabeling';

const execAsync = promisify(exec);

/**
 * セグメント単位の感情分析API
 * transcription_segmentsからセグメントを取得し、各セグメントの音声部分を切り出して感情分析
 */
export async function POST(request: NextRequest) {
  console.log('=== Emotion Analysis Segmented API Called ===');

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recordingId, filePath } = await request.json();
    console.log('Processing:', { recordingId, filePath });

    // 1. transcription_segmentsからセグメント情報を取得
    const { data: segments, error: segmentsError } = await supabase
      .from('transcription_segments')
      .select('*')
      .eq('recording_id', recordingId)
      .order('segment_index', { ascending: true });

    if (segmentsError || !segments || segments.length === 0) {
      console.error('Segments fetch error:', segmentsError);
      return NextResponse.json({ error: 'No segments found for this recording' }, { status: 404 });
    }

    console.log(`Found ${segments.length} segments to analyze`);

    // 2. 音声ファイルをダウンロード
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('voice-recordings')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return NextResponse.json({ error: 'Failed to download audio file' }, { status: 500 });
    }

    const buffer = Buffer.from(await audioData.arrayBuffer());
    const tempDir = '/tmp';
    const tempWavPath = path.join(tempDir, `audio_${recordingId}.wav`);

    await fs.writeFile(tempWavPath, new Uint8Array(buffer));
    console.log(`Saved audio file: ${tempWavPath}`);

    // 3. 各セグメントを並列分析
    const analyzeSegment = async (segment: any) => {
      try {
        const duration = segment.end_time - segment.start_time;
        console.log(`[Segment ${segment.segment_index}] Analyzing: "${segment.text}" (${segment.start_time}s - ${segment.end_time}s, duration: ${duration.toFixed(2)}s)`);

        // セグメント用の一時ファイル
        const segmentWavPath = path.join(tempDir, `segment_${recordingId}_${segment.segment_index}.wav`);

        // ffmpegで音声を切り出し（詳細ログ追加）
        const cutCommand = `ffmpeg -i ${tempWavPath} -ss ${segment.start_time} -to ${segment.end_time} -ar 16000 -ac 1 -y ${segmentWavPath}`;
        console.log(`[Segment ${segment.segment_index}] FFmpeg command: ${cutCommand}`);

        await execAsync(cutCommand);

        // 切り出されたファイルの情報を確認
        const fileStats = await fs.stat(segmentWavPath);
        console.log(`[Segment ${segment.segment_index}] Cut audio file created: ${fileStats.size} bytes`);

        // Python感情分析実行
        const scriptPath = path.join(tempDir, `emotion_${recordingId}_${segment.segment_index}.py`);
        const pythonScript = `
import sys
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')
from inference import inference_core
import json
import os

temp_wav = '${segmentWavPath}'

try:
    print(f"[Python] Analyzing: {temp_wav}", file=sys.stderr)
    result = inference_core(temp_wav)
    print(f"[Python] Raw result: {result}", file=sys.stderr)

    if result and 'summary' in result:
        # セグメントが短いので、summary（平均値）のみ使用
        print(json.dumps(result['summary']))
    else:
        print(json.dumps({"error": "No summary in result"}))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
finally:
    try:
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
    except:
        pass
`;

        await fs.writeFile(scriptPath, pythonScript);

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
          console.log(`[Segment ${segment.segment_index}] Python stderr:`, stderr);
        }

        // JSONパース
        const lines = stdout.split('\n').filter(line => line.trim());
        let pythonResult = null;

        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (line.startsWith('{')) {
            try {
              pythonResult = JSON.parse(line);
              break;
            } catch (e) {
              continue;
            }
          }
        }

        if (!pythonResult || pythonResult.error) {
          console.error(`[Segment ${segment.segment_index}] Analysis failed:`, pythonResult?.error);
          return null;
        }

        // PythonからはsummaryにVAD値が入っているので取り出す
        const arousal = pythonResult.avg_arousal;
        const valence = pythonResult.avg_valence;
        const dominance = pythonResult.avg_dominance;

        // VAD値を詳細にログ
        console.log(`[Segment ${segment.segment_index}] VAD values - Arousal: ${arousal}, Valence: ${valence}, Dominance: ${dominance}`);

        // VAD値から感情ラベルを判定（統一関数を使用）
        const emotionResult = getEmotionFromVAD(arousal, valence, dominance);
        const emotionLabel = emotionResult.label;

        console.log(`[Segment ${segment.segment_index}] Emotion label: ${emotionLabel}`);

        // DBを更新
        const { error: updateError } = await supabase
          .from('transcription_segments')
          .update({
            arousal: arousal,
            valence: valence,
            dominance: dominance,
            emotion_label: emotionLabel,
          })
          .eq('id', segment.id);

        if (updateError) {
          console.error(`[Segment ${segment.segment_index}] Failed to update:`, updateError);
          return null;
        }

        console.log(`[Segment ${segment.segment_index}] ✓ Successfully analyzed and saved`);

        // クリーンアップ
        await fs.unlink(scriptPath).catch(() => {});
        await fs.unlink(segmentWavPath).catch(() => {});

        return {
          ...segment,
          arousal: arousal,
          valence: valence,
          dominance: dominance,
          emotion_label: emotionLabel,
        };

      } catch (error) {
        console.error(`[Segment ${segment.segment_index}] Error:`, error);
        return null;
      }
    };

    // 並列処理で全セグメントを分析（同時最大5セグメントまで）
    console.log(`Starting parallel analysis of ${segments.length} segments (max 5 concurrent)...`);
    const startTime = Date.now();

    const CONCURRENT_LIMIT = 5;
    const results: any[] = [];

    for (let i = 0; i < segments.length; i += CONCURRENT_LIMIT) {
      const chunk = segments.slice(i, i + CONCURRENT_LIMIT);
      console.log(`Processing chunk ${Math.floor(i / CONCURRENT_LIMIT) + 1}: segments ${i + 1}-${Math.min(i + CONCURRENT_LIMIT, segments.length)}`);
      const chunkResults = await Promise.all(chunk.map(segment => analyzeSegment(segment)));
      results.push(...chunkResults);
    }

    const analyzedSegments = results.filter(result => result !== null);

    const endTime = Date.now();
    console.log(`Parallel analysis completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    // 元の音声ファイルをクリーンアップ
    await fs.unlink(tempWavPath).catch(() => {});

    return NextResponse.json({
      success: true,
      analyzedSegments: analyzedSegments.length,
      totalSegments: segments.length,
      segments: analyzedSegments,
    });

  } catch (error) {
    console.error('Emotion analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// getEmotionLabel関数は削除（lib/emotionLabeling.tsの統一関数を使用）
