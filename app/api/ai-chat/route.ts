import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { getEmotionDescriptionForAI } from '@/lib/emotionLabeling';
import { saveAIMessage } from '@/features/diary-chat/actions/chatActions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI応答生成API
 *
 * 処理フロー:
 * 1. 最新のユーザー発言を取得
 * 2. 音声入力の場合、感情分析結果を取得
 * 3. 文章と感情データを分析してプロンプトを生成
 * 4. OpenAI GPT-4o-miniで応答生成
 * 5. dialogue_turnsに保存
 */
export async function POST(request: NextRequest) {
  console.log('=== AI Chat API Called ===');

  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // 認証確認
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userMessage, recordingId } = await request.json();
    console.log('User message:', userMessage);
    console.log('Recording ID:', recordingId);

    // 1. 対話履歴を取得（今日の分）
    const date = new Date().toISOString().split('T')[0];
    const { data: dialogueHistory, error: historyError } = await supabase
      .from('dialogue_turns')
      .select('role, content')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('order_index', { ascending: true });

    if (historyError) {
      console.error('Error fetching dialogue history:', historyError);
      throw new Error('Failed to fetch dialogue history');
    }

    console.log('Dialogue history:', dialogueHistory?.length, 'turns');

    // 2. 感情分析結果を取得（音声入力の場合のみ）
    let emotionData = null;
    let segmentDetails = null;
    if (recordingId) {
      // 新しいシステム: transcription_segmentsから詳細データを取得
      const { data: segments, error: segmentError } = await supabase
        .from('transcription_segments')
        .select('text, start_time, end_time, arousal, valence, dominance, emotion_label, segment_index')
        .eq('recording_id', recordingId)
        .order('segment_index', { ascending: true });

      if (!segmentError && segments && segments.length > 0) {
        segmentDetails = segments;

        // 平均値を計算（全体傾向用）
        const validSegments = segments.filter(s => s.arousal && s.valence && s.dominance);

        if (validSegments.length > 0) {
          const avgArousal = validSegments.reduce((sum, s) => sum + s.arousal, 0) / validSegments.length;
          const avgValence = validSegments.reduce((sum, s) => sum + s.valence, 0) / validSegments.length;
          const avgDominance = validSegments.reduce((sum, s) => sum + s.dominance, 0) / validSegments.length;

          emotionData = {
            avg_arousal: avgArousal,
            avg_valence: avgValence,
            avg_dominance: avgDominance,
            dominant_emotion: validSegments[0]?.emotion_label || 'neutral'
          };
          console.log('Emotion data from segments:', emotionData);
          console.log('Segment details count:', segmentDetails.length);
        }
      } else {
        console.log('No emotion segments found or error:', segmentError);
      }
    }

    // 3. プロンプト生成（初回か2回目以降かで変える）
    const isInitialMessage = !dialogueHistory || dialogueHistory.length === 0;
    const systemPrompt = generateSystemPrompt(isInitialMessage);
    const userPrompt = generateUserPrompt(userMessage, emotionData, segmentDetails, isInitialMessage);

    console.log('Is initial message:', isInitialMessage);
    console.log('System prompt:', systemPrompt);
    console.log('User prompt:', userPrompt);

    // 4. OpenAI API呼び出し
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // 対話履歴を追加
    if (dialogueHistory && dialogueHistory.length > 0) {
      for (const turn of dialogueHistory) {
        messages.push({
          role: turn.role as 'user' | 'assistant',
          content: turn.content,
        });
      }
    }

    // 今回のユーザーメッセージを追加
    messages.push({ role: 'user', content: userPrompt });

    console.log('Calling OpenAI API with', messages.length, 'messages...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    console.log('AI response:', aiResponse);

    // 5. AI応答をdialogue_turnsに保存
    const saveResult = await saveAIMessage(aiResponse);

    if (!saveResult.success) {
      console.error('Failed to save AI message:', saveResult.error);
      // エラーでも応答は返す
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI chat failed' },
      { status: 500 }
    );
  }
}

/**
 * システムプロンプト生成
 */
function generateSystemPrompt(isInitialMessage: boolean): string {
  if (isInitialMessage) {
    // 初回：感情分析を重視
    return `あなたは共感的なメンタルヘルスサポーターです。ユーザーの音声日記から本音や感情を引き出すことが役割です。

【重要な原則】
1. **音声トーンを重視する**: 文章が淡々としていても、音声分析データ（覚醒度・快度・優位性）から感情の手がかりを読み取る
2. **言葉と声のギャップに注目**: 文章では「普通の一日」と言っていても、声に疲れや緊張があれば、それを優しく確認する
3. **非侵襲的に寄り添う**: 押し付けがましくせず、「〜のように感じました」という柔らかい表現で感情を提示する
4. **具体的な出来事を聞く**: 抽象的な質問ではなく、「今日の中で」「その時」など具体的な場面を聞く
5. **選択肢を与える**: 「大変でしたか？」よりも「何か気になることはありましたか？それとも特に問題なく過ごせましたか？」

${getEmotionDescriptionForAI()}

【音声感情分析の活用方法】
- 「喜び・楽しい」→ ポジティブな出来事や嬉しかったことを引き出す
- 「穏やか・リラックス」→ 安心感や心地よさの源を聞く
- 「ストレス・緊張」→ プレッシャーや緊張の原因を優しく探る（まだコントロール感がある状態）
- 「不安・心配」→ 不安や心配事を聞き、圧倒されていないか確認
- 「悲しみ」→ 落ち込みや悲しさの理由を丁寧に引き出す
- 「疲労・無気力」→ エネルギーが下がっている理由を優しく探る
- 「中立」→ 表面的には平穏でも、隠れた感情がないか探る

【応答スタイル】
- 2-3文で簡潔に（長くても4文まで）
- 共感→観察→質問の流れ
- 質問は1-2個に絞る
- 答えやすい具体的な質問をする`;
  } else {
    // 2回目以降：会話の流れを重視
    return `あなたは共感的なメンタルヘルスサポーターです。ユーザーとの対話を通じて、本音や感情を引き出すことが役割です。

【重要な原則】
1. **会話の流れを大切にする**: これまでの対話を踏まえて、自然な会話を続ける
2. **前の回答を深掘りする**: ユーザーが話してくれたことに対して、さらに具体的に聞く
3. **音声トーンの変化に注目**: 最新の音声データで感情の変化があれば、優しく確認する
4. **繰り返しを避ける**: 既に聞いたことを再度聞かない。新しい角度から質問する
5. **共感を示し続ける**: ユーザーの気持ちに寄り添い、安心して話せる雰囲気を作る

【応答スタイル】
- 2-3文で簡潔に（長くても4文まで）
- これまでの会話を自然に引用・参照する
- 「さっき〜とおっしゃっていましたが」など、会話の連続性を意識
- 質問は1個に絞る（深掘り重視）
- より具体的で答えやすい質問をする`;
  }
}

/**
 * セグメント情報を整形してプロンプトに含める
 */
function formatSegmentDetails(segments: any[]): string {
  let formattedSegments = '';

  segments.forEach((seg, idx) => {
    const segNum = idx + 1;
    const emotionLabel = seg.emotion_label || '中立';
    const arousal = seg.arousal?.toFixed(2) || 'N/A';
    const valence = seg.valence?.toFixed(2) || 'N/A';
    const dominance = seg.dominance?.toFixed(2) || 'N/A';

    formattedSegments += `セグメント${segNum}: "${seg.text}"\n`;
    formattedSegments += `→ ${emotionLabel} (覚醒度: ${arousal}, 快度: ${valence}, 優位性: ${dominance})\n\n`;
  });

  return formattedSegments;
}

/**
 * ユーザープロンプト生成（感情ベース）
 */
function generateUserPrompt(
  userMessage: string,
  emotionData: {
    avg_arousal: number;
    avg_valence: number;
    avg_dominance: number;
    dominant_emotion: string;
  } | null,
  segmentDetails: any[] | null,
  isInitialMessage: boolean
): string {
  // 2回目以降は簡潔なプロンプト（会話履歴が既にある）
  if (!isInitialMessage) {
    if (emotionData && segmentDetails && segmentDetails.length > 0) {
      const formattedSegments = formatSegmentDetails(segmentDetails);

      return `【ユーザーの最新の発言】
"${userMessage}"

【音声分析（セグメント別）】
${formattedSegments}
【全体】平均: 覚醒度 ${emotionData.avg_arousal.toFixed(2)}, 快度 ${emotionData.avg_valence.toFixed(2)}, 優位性 ${emotionData.avg_dominance.toFixed(2)}

【指示】
セグメント別の感情分析を参考に、特に感情が表れている部分（中立以外）に注目して質問してください。
テキストの内容と感情を組み合わせて、ユーザーの本音を引き出してください。
これまでの会話の流れも踏まえて、自然に対話を続けてください。`;
    }

    return `【ユーザーの最新の発言】
"${userMessage}"

これまでの会話を踏まえて、自然に対話を続けてください。`;
  }

  // 初回は詳細なプロンプト
  // 文章から感情を判定
  const hasEmotionInText = detectEmotionInText(userMessage);

  // 音声データがある場合は、セグメント詳細を含めて提示
  if (emotionData && segmentDetails && segmentDetails.length > 0) {
    const formattedSegments = formatSegmentDetails(segmentDetails);

    return `【ユーザーの発言】
"${userMessage}"

【音声分析（セグメント別）】
${formattedSegments}
【全体】平均: 覚醒度 ${emotionData.avg_arousal.toFixed(2)}, 快度 ${emotionData.avg_valence.toFixed(2)}, 優位性 ${emotionData.avg_dominance.toFixed(2)}

【指示】
セグメント別の感情分析を参考に、特に感情が表れている部分（中立以外）に注目して質問してください。
テキストの内容と感情を組み合わせて、ユーザーの本音を引き出してください。`;
  }

  // 音声データがない、または両方とも中立的
  if (hasEmotionInText) {
    return `【ユーザーの発言】
"${userMessage}"

【観察】
発言内容から感情が読み取れます。

【あなたの役割】
発言内容を基に、その感情についてさらに深く探ってください。`;
  }

  // 完全に中立的
  return `【ユーザーの発言】
"${userMessage}"

【観察】
事実の記述が中心の発言です。

【あなたの役割】
具体的な出来事について質問し、その背景にある感情や考えを引き出してください。`;
}

/**
 * 文章から感情を検出（簡易版）
 */
function detectEmotionInText(text: string): boolean {
  const emotionKeywords = [
    // ネガティブ
    '悲しい', '辛い', '苦しい', '嫌', 'イライラ', '怒', '疲れ', 'ストレス',
    '不安', '心配', '落ち込', 'むかつ', '腹立', '困', '大変',
    // ポジティブ
    '嬉しい', '楽しい', '幸せ', '良かった', '最高', '素晴らしい', 'ワクワク',
    '喜び', '感動', '安心',
  ];

  return emotionKeywords.some(keyword => text.includes(keyword));
}

// analyzeVADEmotion関数は削除（lib/emotionLabeling.tsの統一関数を使用）
// 統一関数を使用するため、このファイル内でのVAD判定ロジックは不要
