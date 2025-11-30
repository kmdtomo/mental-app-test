import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
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
      model: 'gpt-5-mini',
      messages: messages,
      max_completion_tokens: 1000,
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
  const commonRules = `
【感情データの優先順位判断】
テキストの内容に基づいて、どの感情データを重視するかを判断してください：

1. **優先度：高（ここを深掘りする）**
   - 主観的な感想、結果の報告（例：「負けてしまった」「悔しい」「楽しかった」）
   - 自分の考えや意見を述べている部分
   → この部分の感情データはユーザーの本音として扱い、共感や質問の核にしてください。

2. **優先度：低（ここはスルーする）**
   - 客観的な事実の列挙、状況説明（例：「大会があった」「〜に行った」）
   - 挨拶や繋ぎ言葉
   → この部分に「疲労・無気力」などの感情が出ていても、単なる話し方の癖や一時的なものとして無視してください。

【質問・応答のルール】
1. **まず感情に寄り添い、本音の呼び水にする（重要）**
   - 優先度「高」のセグメントの感情（声の印象）を、会話の切り出しに使う。
   - **一致する場合**: そのまま強調して共感する。
     - 例：「とても楽しそうに聞こえますね！手応えがあったんですね。」
   - **不一致・複雑な場合（重要）**: テキストと感情のギャップや、裏にある感情を言語化する。
     - 例：「『通用した』とおっしゃっていますが、声からは悔しさや悲しみも伝わってきます。手応えがあった分、余計に辛かったのではないですか？」
   - ※「声のトーンが〜」という分析的な表現は避け、あくまで対話相手としての自然な感想として伝える。

2. **その上で、具体的な単語を拾って質問する**
   - 「どんな気持ちでしたか？」は禁止。「詳しく教えて」「何がありましたか？」のような汎用的な質問も避ける
   - **前の文脈にある具体的な単語（名詞・動詞）を拾って質問を作る**
     - 例：「プレゼンで失敗した」→「プレゼンの『どのパート』で詰まってしまったのですか？」
     - 例：「彼氏と喧嘩した」→「喧嘩の『きっかけ』は何だったのですか？」

3. **その他**
   - 感情データはあくまで「どの話題に触れるべきか」の判断材料として使い、会話自体はテキスト内容ベースで行う`;

  if (isInitialMessage) {
    return `あなたは共感的なメンタルヘルスサポーターです。ユーザーの音声日記から本音や感情を引き出すことが役割です。

${commonRules}

【応答の基本方針】
1. テキストの内容を理解し、具体的な出来事を把握する
2. 内容に対して自然に共感する
3. 文脈から具体的に深掘りできる質問をする（漠然とした感情質問は禁止）

【応答スタイル】
- 2-3文で簡潔に
- 共感→具体的な質問の流れ
- 質問は1個に絞る`;
  } else {
    return `あなたは共感的なメンタルヘルスサポーターです。ユーザーとの対話を通じて、本音や感情を引き出すことが役割です。

${commonRules}

【応答の基本方針】
1. これまでの対話を踏まえて、自然な会話を続ける
2. ユーザーが話してくれた具体的な内容についてさらに聞く
3. 繰り返しを避け、新しい角度から質問する

【応答スタイル】
- 2-3文で簡潔に
- これまでの会話を自然に引用・参照する
- 質問は1個に絞る（具体的な深掘り）`;
  }
}

/**
 * セグメント情報を整形してプロンプトに含める（感情分析強化版）
 * 
 * VAD値（音声分析）のみを信頼し、テキストベースの感情判定は一切行わない
 */
function formatSegmentDetails(segments: any[]): string {
  if (!segments || segments.length === 0) return '';

  // シンプルにセグメントごとのテキストと感情ラベルのみ
  let formattedSegments = '';
  segments.forEach((seg, idx) => {
    const segNum = idx + 1;
    const emotionLabel = seg.emotion_label || '中立';

    formattedSegments += `セグメント${segNum}: \"${seg.text}\"\n`;
    formattedSegments += `→ 感情: ${emotionLabel}\n\n`;
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

【音声分析（参考情報）】
${formattedSegments}
これまでの会話を踏まえて、自然に対話を続けてください。`;
    }

    return `【ユーザーの最新の発言】
"${userMessage}"

これまでの会話を踏まえて、自然に対話を続けてください。`;
  }

  // 初回は詳細なプロンプト
  // 音声データがある場合は、セグメント詳細を含めて提示
  if (emotionData && segmentDetails && segmentDetails.length > 0) {
    const formattedSegments = formatSegmentDetails(segmentDetails);

    return `【ユーザーの発言】
"${userMessage}"

【音声分析（参考情報）】
${formattedSegments}
発言内容を基に、具体的な出来事や背景にある感情を引き出してください。`;
  }

  // 音声データがない場合（テキスト入力など）
  return `【ユーザーの発言】
"${userMessage}"

【あなたの役割】
発言内容を基に、具体的な出来事や背景にある感情を引き出してください。`;
}
