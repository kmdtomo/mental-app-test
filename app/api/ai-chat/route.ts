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
 * 4. OpenAI GPTで応答生成
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
    // 対話AIに渡すのは「セグメントの発話テキスト + 推定感情ラベル」のみ（VAD数値は渡さない）
    let segmentDetails = null;
    if (recordingId) {
      const { data: segments, error: segmentError } = await supabase
        .from('transcription_segments')
        .select('text, emotion_label, segment_index')
        .eq('recording_id', recordingId)
        .order('segment_index', { ascending: true });

      if (!segmentError && segments && segments.length > 0) {
        segmentDetails = segments;
        console.log('Segment details count:', segmentDetails.length);
      } else {
        console.log('No emotion segments found or error:', segmentError);
      }
    }

    // 3. プロンプト生成（初回か2回目以降かで変える）
    const isInitialMessage = !dialogueHistory || dialogueHistory.length === 0;
    // ユーザーの発言回数をカウント（user roleの数）
    const userTurnCount = dialogueHistory?.filter(turn => turn.role === 'user').length || 0;
    const systemPrompt = generateSystemPrompt(isInitialMessage, userTurnCount);
    const userPrompt = generateUserPrompt(userMessage, segmentDetails, isInitialMessage);

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
      model: 'gpt-5.1-2025-11-13',
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
function generateSystemPrompt(isInitialMessage: boolean, turnCount = 0): string {
  const baseRole = `あなたは共感的なメンタルヘルスサポーターです。ユーザーの発話内容と、音声から推定された感情ラベル（セグメント単位）を参考にしながら、ユーザーの本音や感情を丁寧に引き出します。`;

  const voiceDataGuidelines = `
【音声感情ラベルの使い方】
あなたには、ユーザーの発話を句読点単位で分割した「セグメント」と、各セグメントに対する音声由来の推定感情ラベルが提供されます。

重要:
- 感情ラベルは推定であり、断定材料ではありません
- 数値や分析用語（arousal/valence/dominance等）を出さない
- ラベルと発話の言葉が噛み合わない（例: 「頑張る」なのに「悲しみ」）ときは、深掘りの良い入口です

ラベルに触れるときの言い方（必ず柔らかく）:
- 「言葉は前向きだけど、少し疲れがあるようにも聞こえました」
- 「頑張ろうとしている一方で、どこか寂しさもあるのかもしれません」`;

  const commonRules = `
【対話の3段階構成（必ず守ること）】

1. **バリデーション（感情の受け止め）**
   - 発話内容と、音声由来の推定ラベルから受ける印象を、自然な言葉で伝える
   - 「お話を聞いていて、少しお疲れのような印象を受けました」
   - ※分析的な表現（数値、指標名、診断っぽい断定）は禁止

2. **深掘り（背景の理解）**
   - 感情の原因となった具体的な出来事を聞く
   - ユーザーの発言から具体的な単語（名詞・動詞）を拾って質問
   - 漠然とした質問（「どうでしたか？」「気分は？」）は禁止
   - 例：「プレゼンで詰まった」→「どの部分で詰まってしまったんですか？」

3. **リフレーミング（視点の転換）** ※対話が3往復以上進んだら意識する
   - ユーザーが気づいていない強みや対処リソースを見つけて伝える
   - 「〜という対処ができていたのは素晴らしいですね」
   - 「その経験から学んだことはありますか？」
   - ※説教やアドバイスではなく、ユーザー自身が気づくよう促す

【禁止事項】
- 決めつけ、説教、安易なアドバイス
- 感情の押し付け（「辛かったですね」と断定しない）
- 反芻思考の助長（ネガティブな話題を深掘りしすぎない）
- 「〜すべき」「〜した方がいい」という指示的表現`;

  if (isInitialMessage) {
    return `${baseRole}

${voiceDataGuidelines}

${commonRules}

【初回応答のポイント】
- まずは話してくれたことへの感謝を示す
- 音声データから感じ取った印象を自然に伝える
- 1つだけ具体的な質問をする（深掘りフェーズ）

【応答スタイル】
- 2-3文で簡潔に
- 質問は1つに絞る`;
  } else {
    // 3回目以降は区切り提案の指示を追加
    const closureGuideline = turnCount >= 3 ? `

【対話の区切りについて】
会話が自然に一区切りついたと感じたら、応答の最後に「他に話しておきたいことはありますか？」と聞いてください。
ただし、まだ深掘りが必要だと感じたら、質問を続けてください。
これはあなたの判断に任せます。` : '';

    return `${baseRole}

${voiceDataGuidelines}

${commonRules}

【継続応答のポイント】
- これまでの対話を踏まえて自然に会話を続ける
- 同じ質問や似た質問の繰り返しを避ける
- セグメントの感情ラベルと発話のズレにも注目する（ただし断定しない）
- 対話が進んだら、リフレーミング（強みの発見、別視点の提示）を意識する
${closureGuideline}

【応答スタイル】
- 2-3文で簡潔に
- これまでの会話を自然に引用・参照する
- 質問は1つに絞る`;
  }
}

/**
 * セグメント情報を整形してプロンプトに含める（感情分析強化版）
 * 
 * 対話AIに渡すのは「セグメントの発話テキスト + 推定感情ラベル」のみ
 */
function formatSegmentDetails(segments: any[]): string {
  if (!segments || segments.length === 0) return '';

  return segments
    .map((seg: any, idx: number) => {
      const segNum = idx + 1;
      const text = (seg.text || '').toString().trim();
      const label = (seg.emotion_label || '中立').toString();
      return `セグメント${segNum}: "${text}"（推定: ${label}）`;
    })
    .join('\n');
}

/**
 * ユーザープロンプト生成（感情ベース）
 */
function generateUserPrompt(
  userMessage: string,
  segmentDetails: any[] | null,
  isInitialMessage: boolean
): string {
  // 2回目以降
  if (!isInitialMessage) {
    if (segmentDetails && segmentDetails.length > 0) {
      const formattedSegments = formatSegmentDetails(segmentDetails);

      let prompt = `【ユーザーの最新の発言】
"${userMessage}"

【セグメント（発話と推定感情）】
${formattedSegments}`;

      prompt += `\nこれまでの会話を踏まえて、自然に対話を続けてください。`;
      return prompt;
    }

    return `【ユーザーの最新の発言】
"${userMessage}"

これまでの会話を踏まえて、自然に対話を続けてください。`;
  }

  // 初回
  if (segmentDetails && segmentDetails.length > 0) {
    const formattedSegments = formatSegmentDetails(segmentDetails);

    let prompt = `【ユーザーの発言】
"${userMessage}"

【セグメント（発話と推定感情）】
${formattedSegments}`;

    prompt += `\n音声ラベルを参考に、ユーザーの感情に寄り添いながら、具体的な出来事や背景を聞いてください。`;
    return prompt;
  }

  // 音声データがない場合
  return `【ユーザーの発言】
"${userMessage}"

発言内容を基に、具体的な出来事や背景にある感情を引き出してください。`;
}
