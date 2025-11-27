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
 * GPT-4o-miniで句読点を付与する（高速化のため短いプロンプト）
 */
async function addPunctuation(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `以下のテキストに句読点（。、）を付けてください。文の内容は変更せず、句読点のみ追加。

${text}

出力: 句読点を付けたテキストのみ`
      }],
      temperature: 0,
      max_tokens: 2000,
    });

    return response.choices[0].message.content?.trim() || text;
  } catch (error) {
    console.error('Punctuation error:', error);
    return text; // エラー時は元のテキストを返す
  }
}

/**
 * 句読点で分割した文に対応する単語のタイムスタンプを探す
 */
function mapSentencesToWords(sentences: string[], words: any[]) {
  const segments = [];
  let wordIndex = 0;

  for (const sentence of sentences) {
    const cleanSentence = sentence.replace(/[。、]/g, '').trim();
    if (!cleanSentence) continue;

    const segmentWords = [];
    let currentText = '';

    // この文に含まれる単語を探す
    while (wordIndex < words.length) {
      const word = words[wordIndex];
      const wordText = word.word || '';

      segmentWords.push(word);
      currentText += wordText;
      wordIndex++;

      // 文の終わりに到達したかチェック
      if (currentText.length >= cleanSentence.length) {
        break;
      }
    }

    if (segmentWords.length > 0) {
      segments.push({
        text: sentence.trim(),
        start: segmentWords[0].start,
        end: segmentWords[segmentWords.length - 1].end,
      });
    }
  }

  return segments;
}

/**
 * 新しいWhisper API（単語レベル + GPT句読点）
 * 単語レベルのタイムスタンプを取得し、GPTで句読点を付けて文単位に分割
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

    // Call Whisper API with word-level timestamps
    console.log('Calling Whisper API with word-level timestamps...');
    const startWhisper = Date.now();
    let transcription: any = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'ja',
          response_format: 'verbose_json',
          timestamp_granularities: ['word'],  // 単語レベルに変更
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

    if (!transcription) {
      console.error('Transcription failed after retries');
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }

    const whisperTime = Date.now() - startWhisper;
    console.log(`Whisper completed in ${whisperTime}ms with ${transcription.words?.length || 0} words`);

    const fullText = transcription.text || '';
    const words = transcription.words || [];

    if (words.length === 0) {
      console.error('No words returned from Whisper');
      return NextResponse.json({ error: 'No transcription available' }, { status: 500 });
    }

    // GPT-4o-miniで句読点を付与（並列処理の準備）
    console.log('Adding punctuation with GPT-4o-mini...');
    const startPunctuation = Date.now();
    const punctuatedText = await addPunctuation(fullText);
    const punctuationTime = Date.now() - startPunctuation;
    console.log(`Punctuation completed in ${punctuationTime}ms`);
    console.log('Punctuated text:', punctuatedText);

    // 句読点で分割してセグメント生成（。と、の両方で分割）
    const startMapping = Date.now();
    const sentences = punctuatedText.split(/[。、]/).filter(s => s.trim());
    const segments = mapSentencesToWords(sentences, words);
    const mappingTime = Date.now() - startMapping;
    console.log(`Mapping completed in ${mappingTime}ms: ${segments.length} segments created`);

    console.log(`Total processing time: ${whisperTime + punctuationTime + mappingTime}ms`);

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
        content: punctuatedText,  // 句読点付きの全文
        input_type: 'voice',
        recording_id: recordingId,
        order_index: orderIndex
      });

    return NextResponse.json({
      success: true,
      text: punctuatedText,  // 句読点付きの全文
      segments: segments,
      segmentCount: segments.length,
      performance: {
        whisper: `${whisperTime}ms`,
        punctuation: `${punctuationTime}ms`,
        mapping: `${mappingTime}ms`,
        total: `${whisperTime + punctuationTime + mappingTime}ms`
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
