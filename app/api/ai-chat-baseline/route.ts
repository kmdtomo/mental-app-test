import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { saveAIMessage } from '@/features/diary-chat/actions/chatActions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI応答生成API（ベースライン/対照群用）
 *
 * 処理フロー:
 * 1. 最新のユーザー発言を取得
 * 2. シンプルな傾聴プロンプトを生成（感情分析データなし）
 * 3. OpenAI GPT-4oで応答生成
 * 4. dialogue_turnsに保存
 */
export async function POST(request: NextRequest) {
  console.log('=== AI Chat Baseline API Called ===');

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

    // 2. プロンプト生成（感情分析なし、シンプルな傾聴）
    const isInitialMessage = !dialogueHistory || dialogueHistory.length === 0;
    const userTurnCount = dialogueHistory?.filter(turn => turn.role === 'user').length || 0;
    const systemPrompt = generateSystemPromptBaseline(isInitialMessage, userTurnCount);
    const userPrompt = generateUserPromptBaseline(userMessage, isInitialMessage);

    console.log('Is initial message:', isInitialMessage);

    // 3. OpenAI API呼び出し
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
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    console.log('AI response:', aiResponse);

    // 4. AI応答をdialogue_turnsに保存
    const saveResult = await saveAIMessage(aiResponse);

    if (!saveResult.success) {
      console.error('Failed to save AI message:', saveResult.error);
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
    });

  } catch (error) {
    console.error('AI Chat Baseline error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI chat failed' },
      { status: 500 }
    );
  }
}

/**
 * システムプロンプト生成（ベースライン用 - 感情分析なし）
 */
function generateSystemPromptBaseline(isInitialMessage: boolean, turnCount = 0): string {
  const baseRole = `あなたは共感的な傾聴者です。ユーザーの話を丁寧に聞き、理解を深めるための質問をします。`;

  const commonRules = `
【対話のガイドライン】

1. **共感的な受け止め**
   - ユーザーの発言を丁寧に受け止める
   - 「そうだったんですね」「なるほど」など自然な相槌
   - 決めつけや押し付けはしない

2. **深掘り質問**
   - 具体的な出来事や状況を聞く
   - ユーザーの発言から具体的な単語を拾って質問
   - 漠然とした質問は避ける

3. **自然な対話**
   - 説教やアドバイスはしない
   - ユーザー自身が考えを整理できるようサポート

【禁止事項】
- 決めつけ、説教、安易なアドバイス
- 「〜すべき」「〜した方がいい」という指示的表現
- 感情の押し付け`;

  if (isInitialMessage) {
    return `${baseRole}

${commonRules}

【初回応答のポイント】
- 話してくれたことへの感謝を示す
- 1つだけ具体的な質問をする

【応答スタイル】
- 2-3文で簡潔に
- 質問は1つに絞る`;
  } else {
    const closureGuideline = turnCount >= 3 ? `

【対話の区切りについて】
会話が自然に一区切りついたと感じたら、応答の最後に「他に話しておきたいことはありますか？」と聞いてください。
ただし、まだ聞きたいことがあれば、質問を続けてください。` : '';

    return `${baseRole}

${commonRules}

【継続応答のポイント】
- これまでの対話を踏まえて自然に会話を続ける
- 同じ質問や似た質問の繰り返しを避ける
${closureGuideline}

【応答スタイル】
- 2-3文で簡潔に
- これまでの会話を自然に引用・参照する
- 質問は1つに絞る`;
  }
}

/**
 * ユーザープロンプト生成（ベースライン用 - 感情分析なし）
 */
function generateUserPromptBaseline(userMessage: string, isInitialMessage: boolean): string {
  if (isInitialMessage) {
    return `【ユーザーの発言】
"${userMessage}"

発言内容を基に、共感的に応答し、具体的な出来事や背景を聞いてください。`;
  }

  return `【ユーザーの最新の発言】
"${userMessage}"

これまでの会話を踏まえて、自然に対話を続けてください。`;
}
