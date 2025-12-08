import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 日次サマリー生成API
 *
 * その日の全対話と感情分析結果から:
 * 1. 日記要約を生成
 * 2. 感情データを集計
 * 3. AIインサイトを生成
 * 4. daily_summariesに保存
 */
export async function POST(request: NextRequest) {
  console.log('=== Generate Summary API Called ===');

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await request.json();
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log('Generating summary for date:', targetDate);

    // 1. 既存のdaily_summariesからtranscription_textを取得（なければnull）
    const { data: existingSummaries, error: summaryFetchError } = await supabase
      .from('daily_summaries')
      .select('transcription_text')
      .eq('user_id', user.id)
      .eq('date', targetDate)
      .limit(1);

    if (summaryFetchError) {
      console.error('Error fetching summary:', summaryFetchError);
      return NextResponse.json({
        error: 'Failed to fetch daily summary',
        details: summaryFetchError.message
      }, { status: 500 });
    }

    const existingSummary = existingSummaries?.[0] || null;
    const transcriptionText = existingSummary?.transcription_text || '';
    console.log('Found transcription text, length:', transcriptionText.length);

    // 2. dialogue_turnsから会話履歴とrecording_idsを取得
    const { data: dialogueTurns, error: dialogueError } = await supabase
      .from('dialogue_turns')
      .select('role, content, recording_id, created_at')
      .eq('user_id', user.id)
      .eq('date', targetDate)
      .order('created_at', { ascending: true });

    if (dialogueError) {
      console.error('Error fetching dialogue:', dialogueError);
      throw new Error('Failed to fetch dialogue');
    }

    // dialogue_turnsが空で、transcription_textもない場合はエラー
    if ((!dialogueTurns || dialogueTurns.length === 0) && !transcriptionText) {
      console.error('No dialogue turns or transcription text found for date:', targetDate);
      return NextResponse.json({
        error: 'この日付の会話データがありません。録音が完了しているか確認してください。',
        date: targetDate
      }, { status: 404 });
    }

    const recordingIds = dialogueTurns
      ?.filter(turn => turn.recording_id)
      .map(turn => turn.recording_id) || [];

    // 日記生成用の会話（最後のAI応答を除外）
    let conversationForDiary = '';
    if (dialogueTurns && dialogueTurns.length > 0) {
      // 最後のメッセージがAIの応答なら除外
      const turnsForDiary = dialogueTurns[dialogueTurns.length - 1]?.role === 'assistant'
        ? dialogueTurns.slice(0, -1)
        : dialogueTurns;

      conversationForDiary = turnsForDiary
        .map(turn => `${turn.role === 'user' ? 'ユーザー' : 'AI'}: ${turn.content}`)
        .join('\n\n');
    }

    // AIインサイト生成用の全会話（最後のAI応答も含む）
    const fullConversation = dialogueTurns
      ?.map(turn => `${turn.role === 'user' ? 'ユーザー' : 'AI'}: ${turn.content}`)
      .join('\n\n') || '';

    const emotionCounts: Record<string, number> = {};
    const allEmotionLabels: string[] = [];

    // transcription_segmentsから感情ラベルを取得
    if (recordingIds.length > 0) {
      const { data: segments, error: segmentError } = await supabase
        .from('transcription_segments')
        .select('emotion_label, segment_index, recording_id')
        .in('recording_id', recordingIds)
        .order('recording_id', { ascending: true })
        .order('segment_index', { ascending: true });

      if (!segmentError && segments && segments.length > 0) {
        // 感情ラベルをカウント
        for (const segment of segments) {
          const label = segment.emotion_label;
          if (label && label !== 'undefined' && label !== 'null') {
            emotionCounts[label] = (emotionCounts[label] || 0) + 1;
            allEmotionLabels.push(label);
          }
        }
      }
    }

    // 主要な感情を決定（最も多く出現した感情）
    let dominantEmotion = '中立';
    if (Object.keys(emotionCounts).length > 0) {
      dominantEmotion = Object.entries(emotionCounts).reduce((a, b) =>
        b[1] > a[1] ? b : a
      )[0];
    }

    // 感情の変化パターンを検出（重複を除いた順序）
    const emotionFlow: string[] = [];
    let prevEmotion = '';
    for (const emotion of allEmotionLabels) {
      if (emotion !== prevEmotion) {
        emotionFlow.push(emotion);
        prevEmotion = emotion;
      }
    }

    console.log('Emotion summary:', {
      dominantEmotion,
      emotionCounts,
      emotionFlow
    });

    const summaryPrompt = `以下の会話内容から、要点をピックアップして簡潔な日記を書いてください。

【会話内容】
${conversationForDiary || transcriptionText}

【要件】
- 出来事の記述と、その時の感情・体調の変化を含める
- 会話の中で明らかになった気持ちの変化も反映する
- 一人称（「私」は省略可）で自然な文章に
- 接続詞を使って読みやすく
- 2-3段落、150-200文字程度
- 日付表現は不要
- 箇条書き禁止`;

    // 感情の変化パターンを文字列化
    const emotionFlowText = emotionFlow.length > 0
      ? emotionFlow.join(' → ')
      : '感情データなし';

    const insightPrompt = `以下の音声分析結果と会話内容から、今日の心の状態を伝えてください。

【音声分析結果】
全体的な感情: ${dominantEmotion}（最も多く検出された感情）
${emotionFlow.length > 1 ? `感情の変化: ${emotionFlowText}` : ''}

【会話内容】
${fullConversation || transcriptionText}

【要件】
- 会話の内容と感情の変化を踏まえて、今日の心の状態を伝える
- 具体的な場面を引用しながら「〜という話をされていましたが、その時の声には〜が表れていました」のように記述
- 2-3文、100-150文字程度
- 共感的で優しい口調
- 専門用語は使わない`;

    const [summaryResponse, insightResponse] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: summaryPrompt }],
        max_completion_tokens: 1000,
      }),
      openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: insightPrompt }],
        max_completion_tokens: 1000,
      })
    ]);

    const diarySummary = summaryResponse.choices[0]?.message?.content || '';
    const aiInsights = insightResponse.choices[0]?.message?.content || '';

    console.log('AI summary generated');

    // 4. daily_summariesを更新または作成
    const summaryData = {
      formatted_text: diarySummary,
      avg_arousal: null,
      avg_valence: null,
      avg_dominance: null,
      dominant_emotion: dominantEmotion,
      emotion_distribution: emotionCounts,
      total_recordings: recordingIds.length,
      ai_insights: aiInsights,
      updated_at: new Date().toISOString(),
    };

    let summaryError;
    if (existingSummary) {
      // 既存のサマリーを更新
      const { error } = await supabase
        .from('daily_summaries')
        .update(summaryData)
        .eq('user_id', user.id)
        .eq('date', targetDate);
      summaryError = error;
    } else {
      // 新規サマリーを作成
      const { error } = await supabase
        .from('daily_summaries')
        .insert({
          user_id: user.id,
          date: targetDate,
          transcription_text: conversationForDiary || '',
          ...summaryData,
        });
      summaryError = error;
    }

    if (summaryError) {
      console.error('Error saving summary:', summaryError);
      throw new Error('Failed to save summary');
    }

    console.log('Summary saved successfully');

    return NextResponse.json({
      success: true,
      summary: {
        date: targetDate,
        diarySummary,
        aiInsights,
        emotionSummary: {
          dominantEmotion,
          emotionFlow,
          emotionDistribution: emotionCounts,
          totalRecordings: recordingIds.length,
        }
      }
    });

  } catch (error) {
    console.error('Generate summary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Summary generation failed' },
      { status: 500 }
    );
  }
}
