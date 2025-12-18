import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getEmotionFromVAD } from '@/lib/emotionLabeling';

/**
 * セグメント単位の感情分析API
 * transcription_segmentsからセグメントを取得し、Modal側で一括感情分析
 * ffmpegによる音声分割はModal側で実行（Vercel環境にはffmpegがないため）
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

    // 音声データをBase64に変換
    const buffer = Buffer.from(await audioData.arrayBuffer());
    const audioBase64 = buffer.toString('base64');
    console.log(`Audio file size: ${buffer.length} bytes`);

    // 3. セグメント情報を整形
    const segmentData = segments.map(seg => ({
      segment_index: seg.segment_index,
      start_time: seg.start_time,
      end_time: seg.end_time,
      text: seg.text,
    }));

    // 4. Modal一括分析エンドポイントを呼び出し
    const emotionAnalysisUrl = process.env.NEXT_PUBLIC_EMOTION_ANALYSIS_SEGMENTS_URL;

    if (!emotionAnalysisUrl) {
      throw new Error("Emotion analysis segments URL is not configured");
    }

    console.log(`Calling Modal batch analysis endpoint...`);
    const startTime = Date.now();

    const modalResponse = await fetch(emotionAnalysisUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64: audioBase64,
        segments: segmentData,
      })
    });

    if (!modalResponse.ok) {
      const errText = await modalResponse.text();
      console.error(`Modal error: ${modalResponse.status} - ${errText}`);
      return NextResponse.json({ error: 'Modal analysis failed' }, { status: 500 });
    }

    const modalResult = await modalResponse.json();
    const endTime = Date.now();
    console.log(`Modal batch analysis completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    if (modalResult.error) {
      console.error('Modal returned error:', modalResult.error);
      return NextResponse.json({ error: modalResult.error }, { status: 500 });
    }

    // 5. 結果をDBに保存
    const analyzedSegments = [];

    for (const result of modalResult.results || []) {
      if (result.error || result.skipped) {
        console.log(`[Segment ${result.segment_index}] Skipped or error: ${result.error || 'skipped'}`);
        continue;
      }

      const segment = segments.find(s => s.segment_index === result.segment_index);
      if (!segment) continue;

      // VAD値から感情ラベルを判定
      const emotionResult = getEmotionFromVAD(result.arousal, result.valence, result.dominance);
      const emotionLabel = emotionResult.label;

      console.log(`[Segment ${result.segment_index}] VAD: A=${result.arousal.toFixed(3)}, V=${result.valence.toFixed(3)}, D=${result.dominance.toFixed(3)} -> ${emotionLabel}`);

      // DBを更新
      const { error: updateError } = await supabase
        .from('transcription_segments')
        .update({
          arousal: result.arousal,
          valence: result.valence,
          dominance: result.dominance,
          emotion_label: emotionLabel,
        })
        .eq('id', segment.id);

      if (updateError) {
        console.error(`[Segment ${result.segment_index}] Failed to update:`, updateError);
        continue;
      }

      console.log(`[Segment ${result.segment_index}] ✓ Successfully saved`);

      analyzedSegments.push({
        ...segment,
        arousal: result.arousal,
        valence: result.valence,
        dominance: result.dominance,
        emotion_label: emotionLabel,
      });
    }

    console.log(`Analysis complete: ${analyzedSegments.length}/${segments.length} segments analyzed`);

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
