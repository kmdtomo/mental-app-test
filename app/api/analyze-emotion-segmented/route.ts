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

        // 0秒以下のセグメントはスキップ（FFmpegエラー防止）
        if (duration <= 0.05) {
          console.log(`[Segment ${segment.segment_index}] Skipping: duration too short (${duration.toFixed(3)}s)`);
          return null;
        }

        // セグメント用の一時ファイル
        const segmentWavPath = path.join(tempDir, `segment_${recordingId}_${segment.segment_index}.wav`);

        // ffmpegで音声を切り出し（詳細ログ追加）
        const cutCommand = `ffmpeg -i ${tempWavPath} -ss ${segment.start_time} -to ${segment.end_time} -ar 16000 -ac 1 -y ${segmentWavPath}`;
        console.log(`[Segment ${segment.segment_index}] FFmpeg command: ${cutCommand}`);

        await execAsync(cutCommand);

        // 切り出されたファイルの情報を確認
        const fileStats = await fs.stat(segmentWavPath);
        console.log(`[Segment ${segment.segment_index}] Cut audio file created: ${fileStats.size} bytes`);

        // Modalへ送信するためにファイルを読み込む
        const wavBuffer = await fs.readFile(segmentWavPath);
        const audioBase64 = wavBuffer.toString('base64');
        const emotionAnalysisUrl = process.env.NEXT_PUBLIC_EMOTION_ANALYSIS_URL;

        if (!emotionAnalysisUrl) {
          throw new Error("Emotion analysis URL is not configured");
        }

        console.log(`[Segment ${segment.segment_index}] Calling Modal...`);

        // Modalへリクエスト
        const lambdaResponse = await fetch(emotionAnalysisUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_base64: audioBase64,
            format: 'wav'
          })
        });

        if (!lambdaResponse.ok) {
          const errText = await lambdaResponse.text();
          console.error(`[Segment ${segment.segment_index}] Lambda error: ${lambdaResponse.status} - ${errText}`);
          return null;
        }

        const lambdaResult = await lambdaResponse.json();
        console.log(`[Segment ${segment.segment_index}] Lambda response:`, JSON.stringify(lambdaResult));

        // PythonからはsummaryにVAD値が入っているので取り出す 
        // -> Lambda化により、直接 {arousal, valence, dominance} が返る
        const arousal = lambdaResult.arousal;
        const valence = lambdaResult.valence;
        const dominance = lambdaResult.dominance;

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
        // await fs.unlink(scriptPath).catch(() => {}); // Pythonスクリプトはもう作らない
        await fs.unlink(segmentWavPath).catch(() => { });

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

    // 並列処理で全セグメントを分析（完全並列化）
    console.log(`Starting full parallel analysis of ${segments.length} segments via Lambda...`);
    const startTime = Date.now();

    // 全セグメントを同時にLambdaに投げる
    const results = await Promise.all(segments.map(segment => analyzeSegment(segment)));

    const analyzedSegments = results.filter(result => result !== null);

    const endTime = Date.now();
    console.log(`Parallel analysis completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    // 元の音声ファイルをクリーンアップ
    await fs.unlink(tempWavPath).catch(() => { });

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
