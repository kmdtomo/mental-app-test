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
    if (recordingId) {
      const { data: emotionResult, error: emotionError } = await supabase
        .from('emotion_analysis_results')
        .select('avg_arousal, avg_valence, avg_dominance, dominant_emotion')
        .eq('recording_id', recordingId)
        .single();

      if (!emotionError && emotionResult) {
        emotionData = emotionResult;
        console.log('Emotion data:', emotionData);
      } else {
        console.log('No emotion data found or error:', emotionError);
      }
    }

    // 3. プロンプト生成
    const systemPrompt = generateSystemPrompt();
    const userPrompt = generateUserPrompt(userMessage, emotionData);

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
function generateSystemPrompt(): string {
  return `あなたはメンタルヘルスをサポートするAIカウンセラーです。
ユーザーの音声日記の内容と感情分析データをもとに、本音を引き出すために深掘りする質問をしてください。

【重要な原則】
1. 共感的で優しい口調を使う
2. 批判や評価はしない
3. オープンエンドな質問で本音を引き出す
4. 感情を言語化するサポートをする
5. ユーザーのペースを尊重する
6. 質問は1つか2つに絞り、簡潔にする

【応答スタイル】
- 長すぎない応答を心がける（3-4文程度）
- 共感を示した後、質問をする
- 質問は具体的で答えやすいものにする`;
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
  } | null
): string {
  // 文章から感情を判定（簡易的な判定）
  const hasEmotionInText = detectEmotionInText(userMessage);

  // ケース1: 文章から感情が読み取れる場合
  if (hasEmotionInText) {
    return `ユーザーの発言: "${userMessage}"

この発言について、内容を基に深掘りする質問をしてください。`;
  }

  // ケース2: 文章は中立的だが、音声感情分析でネガティブ感情検出
  if (emotionData && isNegativeEmotion(emotionData.dominant_emotion)) {
    return `ユーザーの発言: "${userMessage}"

文章は中立的ですが、音声分析では「${getEmotionLabel(emotionData.dominant_emotion)}」の傾向が見られます。
音声データ: 覚醒度=${emotionData.avg_arousal.toFixed(2)}, 快度=${emotionData.avg_valence.toFixed(2)}, 優位性=${emotionData.avg_dominance.toFixed(2)}

声のトーンから察して、優しく感情を確認する質問をしてください。`;
  }

  // ケース3: 文章も感情も中立的 → 文章ベースで深掘り
  return `ユーザーの発言: "${userMessage}"

この発言について、内容を基に深掘りする質問をしてください。`;
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

/**
 * ネガティブ感情かどうか判定
 */
function isNegativeEmotion(emotion: string): boolean {
  const negativeEmotions = ['sad', 'angry', 'stressed', 'tired'];
  return negativeEmotions.includes(emotion);
}

/**
 * 感情ラベルの日本語変換
 */
function getEmotionLabel(emotion: string): string {
  const labels: Record<string, string> = {
    sad: '悲しみ',
    angry: '怒り',
    stressed: 'ストレス',
    tired: '疲労',
    happy: '喜び',
    excited: '興奮',
    calm: '穏やか',
    neutral: '中立',
  };
  return labels[emotion] || emotion;
}
