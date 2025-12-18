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

    // 日記用：ユーザーの発言のみ抽出
    const userOnlyContent = dialogueTurns
      ?.filter(turn => turn.role === 'user')
      .map(turn => turn.content)
      .join('\n\n') || transcriptionText;

    const summaryPrompt = `以下の発言内容から、その人が書いた日記を作成してください。

【発言内容】
${userOnlyContent}

【日記のスタイル】
- 発言者の話し方や言葉遣いに合わせた文体で書く
- 「〜した」「〜だった」「〜と思う」など、日記らしい過去形の語尾を基本とする
- 言っていないことは書かない

【例】
「今日は仕事が忙しかった。午前中に会議があり、午後は資料作成に追われた。疲れたが、なんとか終わらせることができた。明日は少し余裕がありそうだ。」

【形式】
- 2-3段落、150-200文字程度
- 日付や箇条書きは使わない`;

    // 感情データの有無を判定（ベースラインかどうか）
    const hasEmotionData = Object.keys(emotionCounts).length > 0;

    // 感情の変化パターンを文字列化
    const emotionFlowText = emotionFlow.length > 0
      ? emotionFlow.join(' → ')
      : '感情データなし';

    // 日記要約は両群とも生成
    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: summaryPrompt }],
      max_completion_tokens: 1000,
    });

    const diarySummary = summaryResponse.choices[0]?.message?.content || '';

    // AIインサイトは感情データがある場合のみ生成
    let aiInsights = '';
    if (hasEmotionData) {
      const insightPrompt = `以下の音声分析結果と会話内容から、カウンセラーとして今日の心の状態についてフィードバックしてください。

【音声分析結果】
全体的な感情: ${dominantEmotion}
${emotionFlow.length > 1 ? `感情の変化: ${emotionFlowText}` : ''}
感情の分布: ${Object.entries(emotionCounts).map(([k, v]) => `${k}(${v}回)`).join(', ') || 'なし'}

【会話内容】
${fullConversation || transcriptionText}

【要件】
- 音声から読み取れた感情の特徴を、具体的な会話内容と紐づけて伝える
- 「〜についてお話しされている時、声に力強さがありました」のように具体的に
- 感情の揺れや変化があれば、それが何を意味しているか優しく伝える
- ポジティブな変化や強みがあれば、積極的に取り上げる
- 3-4文、120-180文字程度
- 共感的で温かい口調（説教・アドバイスは禁止）`;

      const insightResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: insightPrompt }],
        max_completion_tokens: 1000,
      });

      aiInsights = insightResponse.choices[0]?.message?.content || '';
    } else {
      // ベースライン（感情分析なし）の場合のメッセージ
      aiInsights = 'このセッションは感情分析なしモードで記録されたため、音声感情に基づくフィードバックはありません。';
    }

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
      // 既存のサマリーを更新（transcription_textも最新に）
      const { error } = await supabase
        .from('daily_summaries')
        .update({
          ...summaryData,
          transcription_text: userOnlyContent || '',
        })
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
