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

    // 1. 既存のdaily_summariesからtranscription_textを取得
    const { data: existingSummary, error: summaryFetchError } = await supabase
      .from('daily_summaries')
      .select('transcription_text')
      .eq('user_id', user.id)
      .eq('date', targetDate)
      .single();

    if (summaryFetchError) {
      console.error('Error fetching summary:', summaryFetchError);
      return NextResponse.json({
        error: 'Failed to fetch daily summary',
        details: summaryFetchError.message
      }, { status: 500 });
    }

    if (!existingSummary) {
      console.error('No daily summary found for date:', targetDate);
      return NextResponse.json({
        error: 'この日付の日記データが見つかりません。先に録音を行ってください。',
        date: targetDate
      }, { status: 404 });
    }

    const transcriptionText = existingSummary.transcription_text || '';
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

    let emotionResults = [];
    let totalSegments = 0;
    let sumArousal = 0;
    let sumValence = 0;
    let sumDominance = 0;
    const emotionCounts: Record<string, number> = {};

    if (recordingIds.length > 0) {
      const { data: emotions, error: emotionError } = await supabase
        .from('emotion_analysis_results')
        .select('avg_arousal, avg_valence, avg_dominance, dominant_emotion, segments, total_segments')
        .in('recording_id', recordingIds);

      if (!emotionError && emotions) {
        emotionResults = emotions;

        // 感情データを集計
        for (const emotion of emotions) {
          if (emotion.avg_arousal) sumArousal += emotion.avg_arousal;
          if (emotion.avg_valence) sumValence += emotion.avg_valence;
          if (emotion.avg_dominance) sumDominance += emotion.avg_dominance;
          totalSegments += emotion.total_segments || 0;

          // 各セグメントの感情をカウント
          if (emotion.segments && Array.isArray(emotion.segments)) {
            for (const segment of emotion.segments) {
              const emo = segment.emotion;
              // undefinedやnullの感情はスキップ
              if (emo && emo !== 'undefined' && emo !== 'null') {
                emotionCounts[emo] = (emotionCounts[emo] || 0) + 1;
              }
            }
          }
        }
      }
    }

    const avgArousal = emotionResults.length > 0 ? sumArousal / emotionResults.length : null;
    const avgValence = emotionResults.length > 0 ? sumValence / emotionResults.length : null;
    const avgDominance = emotionResults.length > 0 ? sumDominance / emotionResults.length : null;

    // 主要な感情を決定
    let dominantEmotion = 'neutral';
    if (Object.keys(emotionCounts).length > 0) {
      dominantEmotion = Object.entries(emotionCounts).reduce((a, b) =>
        b[1] > a[1] ? b : a
      )[0];
    }

    console.log('Emotion summary:', {
      avgArousal,
      avgValence,
      avgDominance,
      dominantEmotion,
      emotionCounts
    });

    // 3. AIで日記要約とインサイトを生成
    console.log('Generating AI summary...');

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

    const insightPrompt = `以下の音声分析結果と会話内容から、感情状態を伝えてください。

【音声分析結果（最重要）】
エネルギーレベル: ${avgArousal?.toFixed(2) || 'N/A'} / 5.0（低い=疲れ・落ち着き、高い=興奮・緊張）
気分: ${avgValence?.toFixed(2) || 'N/A'} / 5.0（低い=ネガティブ、高い=ポジティブ）

【会話内容（参考）】
${fullConversation || transcriptionText}

【要件】
- 音声の特徴から読み取れる感情状態を中心に記述
- 「声のトーンから」「声には〜が表れています」など、音声分析を明示
- 専門用語は使わない（覚醒度→エネルギー/元気、快度→気分/気持ち）
- 言葉と声のギャップがあれば優しく指摘
- 2文、80-120文字程度
- 共感的で優しい口調

【音声分析の解釈基準】
- エネルギー低 × 気分低 = 疲労・落ち込み → 「疲れている」「元気がない」「気持ちが沈んでいる」
- エネルギー高 × 気分低 = ストレス・緊張 → 「緊張している」「ストレスを感じている」「張りつめている」
- エネルギー高 × 気分高 = 喜び・興奮 → 「元気」「明るい」「前向き」
- エネルギー低 × 気分高 = 穏やか・リラックス → 「落ち着いている」「穏やか」「リラックス」`;

    const [summaryResponse, insightResponse] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: insightPrompt }],
        temperature: 0.7,
        max_tokens: 300,
      })
    ]);

    const diarySummary = summaryResponse.choices[0]?.message?.content || '';
    const aiInsights = insightResponse.choices[0]?.message?.content || '';

    console.log('AI summary generated');

    // 4. daily_summariesを更新（transcription_textは既存のものを保持）
    const { error: summaryError } = await supabase
      .from('daily_summaries')
      .update({
        formatted_text: diarySummary,
        avg_arousal: avgArousal,
        avg_valence: avgValence,
        avg_dominance: avgDominance,
        dominant_emotion: null,
        emotion_distribution: null,
        total_recordings: recordingIds.length,
        ai_insights: aiInsights,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('date', targetDate);

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
          avgArousal,
          avgValence,
          avgDominance,
          dominantEmotion,
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
