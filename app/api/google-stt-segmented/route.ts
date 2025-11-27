import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { SpeechClient } from '@google-cloud/speech';
import { google } from '@google-cloud/speech/build/protos/protos';

// Google Cloud Speech-to-Text クライアント初期化
const speechClient = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

/**
 * Google Cloud Speech-to-Text API（word-level segmented）
 * より細かいセグメント分割を実現
 */
export async function POST(request: NextRequest) {
  console.log('=== Google STT Segmented API Called ===');

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

    // Convert Blob to Buffer
    const audioBytes = Buffer.from(await fileData.arrayBuffer());

    // Google Cloud Speech-to-Text API 設定
    const audio: google.cloud.speech.v1.IRecognitionAudio = {
      content: audioBytes.toString('base64'),
    };

    const config: google.cloud.speech.v1.IRecognitionConfig = {
      encoding: 'LINEAR16', // WAV形式
      sampleRateHertz: 48000, // WAVファイルのサンプルレート（録音時の実際の値）
      languageCode: 'ja-JP', // 日本語
      enableWordTimeOffsets: true, // word-levelタイムスタンプを有効化
      model: 'latest_long', // 最新の長時間音声モデル
      useEnhanced: true, // 拡張モデルを使用
      enableAutomaticPunctuation: true, // 自動句読点
    };

    const recognizeRequest: google.cloud.speech.v1.IRecognizeRequest = {
      audio: audio,
      config: config,
    };

    // Call Google Cloud Speech-to-Text API
    console.log('Calling Google Cloud Speech-to-Text API...');
    const startTime = Date.now();

    let response;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        [response] = await speechClient.recognize(recognizeRequest);
        break;
      } catch (error: any) {
        retryCount++;
        console.error(`Google STT API attempt ${retryCount} failed:`, error);

        if (retryCount >= maxRetries) {
          throw error;
        }

        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    const endTime = Date.now();
    console.log(`Google STT completed in ${(endTime - startTime) / 1000}s`);

    // レスポンスからword-levelタイムスタンプを取得
    const results = response?.results || [];
    console.log(`Received ${results.length} results from Google STT`);

    // word-levelからセグメントを構築
    const segments: Array<{
      segment_index: number;
      text: string;
      start_time: number;
      end_time: number;
    }> = [];

    let fullText = '';

    results.forEach((result, resultIndex) => {
      const alternative = result.alternatives?.[0];
      if (!alternative) return;

      const words = alternative.words || [];
      console.log(`Result ${resultIndex}: ${words.length} words`);

      // デバッグ: transcript（句読点付きテキスト）を確認
      if (resultIndex === 0) {
        console.log('Transcript:', alternative.transcript);
        console.log('First 10 words:', words.slice(0, 10).map(w => ({
          word: w.word,
          start: w.startTime?.seconds ? Number(w.startTime.seconds) + (Number(w.startTime.nanos || 0) / 1e9) : 0,
          end: w.endTime?.seconds ? Number(w.endTime.seconds) + (Number(w.endTime.nanos || 0) / 1e9) : 0,
        })));
        console.log('All words with punctuation check:', words.map(w => w.word).join(''));
      }

      // 句読点ベースでセグメント化（。！？で区切る）
      type SegmentType = { text: string; start_time: number; end_time: number };
      let currentSegment: SegmentType | null = null;

      words.forEach((wordInfo, wordIndex) => {
        const word = wordInfo.word || '';
        const startTime = wordInfo.startTime?.seconds
          ? Number(wordInfo.startTime.seconds) + (Number(wordInfo.startTime.nanos || 0) / 1e9)
          : 0;
        const endTime = wordInfo.endTime?.seconds
          ? Number(wordInfo.endTime.seconds) + (Number(wordInfo.endTime.nanos || 0) / 1e9)
          : 0;

        if (!currentSegment) {
          // 新しいセグメント開始
          currentSegment = {
            text: word,
            start_time: startTime,
            end_time: endTime,
          };
        } else {
          // 現在のセグメントに追加
          currentSegment.text += word;
          currentSegment.end_time = endTime;
        }

        // 句読点（。！？）で区切る、または最後の単語
        const hasPunctuation = word.match(/[。！？]/);
        const isLastWord = wordIndex === words.length - 1;

        if ((hasPunctuation || isLastWord) && currentSegment) {
          segments.push({
            segment_index: segments.length,
            text: currentSegment.text,
            start_time: currentSegment.start_time,
            end_time: currentSegment.end_time,
          });
          currentSegment = null;
        }

        fullText += word;
      });

      // 残りのセグメントがあれば追加
      if (currentSegment !== null) {
        const finalSegment: SegmentType = currentSegment;
        segments.push({
          segment_index: segments.length,
          text: finalSegment.text,
          start_time: finalSegment.start_time,
          end_time: finalSegment.end_time,
        });
      }

      // 句読点を追加
      if (alternative.transcript) {
        fullText = alternative.transcript;
      }
    });

    console.log(`Created ${segments.length} word-level segments`);

    // セグメントをDBに保存
    if (segments.length > 0) {
      const segmentsToInsert = segments.map((segment) => ({
        user_id: user.id,
        recording_id: recordingId,
        segment_index: segment.segment_index,
        text: segment.text,
        start_time: segment.start_time,
        end_time: segment.end_time,
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
      provider: 'google-cloud-speech',
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
