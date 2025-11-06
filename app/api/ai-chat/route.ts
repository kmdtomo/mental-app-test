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

    // 3. プロンプト生成（初回か2回目以降かで変える）
    const isInitialMessage = !dialogueHistory || dialogueHistory.length === 0;
    const systemPrompt = generateSystemPrompt(isInitialMessage);
    const userPrompt = generateUserPrompt(userMessage, emotionData, isInitialMessage);

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

【音声感情分析の活用方法】
- 覚醒度が低い＋快度が低い → 疲労や落ち込みの可能性。エネルギーが下がっている理由を優しく探る
- 覚醒度が高い＋快度が低い → ストレスや緊張の可能性。プレッシャーや不安を感じていないか確認
- 覚醒度が高い＋快度が高い → ポジティブな興奮。良い出来事や嬉しかったことを引き出す
- 覚醒度が低い＋快度が高い → 穏やかでリラックス。安心感や心地よさの源を聞く
- 快度だけが低い → 感情的な負担がある可能性。何が心に引っかかっているか探る

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
  isInitialMessage: boolean
): string {
  // 2回目以降は簡潔なプロンプト（会話履歴が既にある）
  if (!isInitialMessage) {
    if (emotionData) {
      const emotionAnalysis = analyzeVADEmotion(emotionData);

      return `【ユーザーの最新の発言】
"${userMessage}"

【音声分析】
覚醒度: ${emotionData.avg_arousal.toFixed(2)}, 快度: ${emotionData.avg_valence.toFixed(2)}, 優位性: ${emotionData.avg_dominance.toFixed(2)}
感情: ${emotionAnalysis.emotionLabel}

これまでの会話を踏まえて、自然に対話を続けてください。`;
    }

    return `【ユーザーの最新の発言】
"${userMessage}"

これまでの会話を踏まえて、自然に対話を続けてください。`;
  }

  // 初回は詳細なプロンプト
  // 文章から感情を判定
  const hasEmotionInText = detectEmotionInText(userMessage);

  // 音声データがある場合は常に両方を提示
  if (emotionData) {
    const emotionAnalysis = analyzeVADEmotion(emotionData);

    // 文章と音声の両方に感情がある場合
    if (hasEmotionInText && emotionAnalysis.hasSignificantEmotion) {
      return `【ユーザーの発言】
"${userMessage}"

【音声分析結果】
- 覚醒度: ${emotionData.avg_arousal.toFixed(2)} / 5.0
- 快度: ${emotionData.avg_valence.toFixed(2)} / 5.0
- 優位性: ${emotionData.avg_dominance.toFixed(2)} / 5.0
- 検出された感情: ${emotionAnalysis.emotionLabel}

【観察】
発言内容には感情表現が含まれており、音声トーンからも${emotionAnalysis.description}が感じられます。

【あなたの役割】
文章の内容と音声分析データの両方を考慮して、ユーザーの感情をより深く理解し、本音を引き出してください。`;
    }

    // 文章は感情的だが、音声は中立的
    if (hasEmotionInText && !emotionAnalysis.hasSignificantEmotion) {
      return `【ユーザーの発言】
"${userMessage}"

【音声分析結果】
- 覚醒度: ${emotionData.avg_arousal.toFixed(2)} / 5.0
- 快度: ${emotionData.avg_valence.toFixed(2)} / 5.0
- 優位性: ${emotionData.avg_dominance.toFixed(2)} / 5.0
- 検出された感情: ${emotionAnalysis.emotionLabel}

【観察】
発言内容には感情表現が含まれていますが、音声トーンは比較的落ち着いています。

【あなたの役割】
言葉では感情を表現していても、声のトーンが落ち着いている理由を探ってください。もしかすると、表面的な感情と内面の気持ちにギャップがあるかもしれません。`;
    }

    // 文章は中立的だが、音声に感情がある
    if (!hasEmotionInText && emotionAnalysis.hasSignificantEmotion) {
      return `【ユーザーの発言】
"${userMessage}"

【音声分析結果】
- 覚醒度: ${emotionData.avg_arousal.toFixed(2)} / 5.0
- 快度: ${emotionData.avg_valence.toFixed(2)} / 5.0
- 優位性: ${emotionData.avg_dominance.toFixed(2)} / 5.0
- 検出された感情: ${emotionAnalysis.emotionLabel}

【観察】
発言は事実の記述のみですが、音声トーンからは${emotionAnalysis.description}が感じられます。

【あなたの役割】
言葉にしていない感情が声に表れています。特に「${emotionAnalysis.emotionLabel}」の兆候が見られるため、優しく寄り添いながら、その感情について話せるように導いてください。`;
    }
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

/**
 * VAD値から感情を分析
 */
function analyzeVADEmotion(emotionData: {
  avg_arousal: number;
  avg_valence: number;
  avg_dominance: number;
}): {
  hasSignificantEmotion: boolean;
  description: string;
  emotionLabel: string;
} {
  const { avg_arousal, avg_valence, avg_dominance } = emotionData;

  // 中立範囲を狭める（より敏感に検出）
  const isNeutralValence = avg_valence >= 3.7 && avg_valence <= 4.3;
  const isNeutralArousal = avg_arousal >= 3.7 && avg_arousal <= 4.3;

  // 完全に中立的な場合（かなり狭い範囲）
  if (isNeutralValence && isNeutralArousal) {
    return {
      hasSignificantEmotion: false,
      description: '特に感情的な変化が見られない中立的な状態',
      emotionLabel: '中立'
    };
  }

  // 悲しみ・疲労（低覚醒・低快度） - 閾値を緩和
  if (avg_arousal <= 3.3 && avg_valence <= 3.8) {
    return {
      hasSignificantEmotion: true,
      description: '元気がない様子、疲労感、エネルギーの低下',
      emotionLabel: '悲しみ・疲労'
    };
  }

  // ストレス・緊張（高覚醒・低快度）
  if (avg_arousal >= 3.8 && avg_valence <= 3.7) {
    return {
      hasSignificantEmotion: true,
      description: '緊張感、ストレス、不安の兆候',
      emotionLabel: 'ストレス・緊張'
    };
  }

  // 喜び・興奮（高覚醒・高快度）
  if (avg_arousal >= 3.8 && avg_valence >= 4.2) {
    return {
      hasSignificantEmotion: true,
      description: '明るさ、活気、ポジティブな興奮',
      emotionLabel: '喜び・興奮'
    };
  }

  // 穏やか・リラックス（低覚醒・高快度）
  if (avg_arousal <= 3.3 && avg_valence >= 4.2) {
    return {
      hasSignificantEmotion: true,
      description: '穏やかさ、リラックス、安心感',
      emotionLabel: '穏やか'
    };
  }

  // 快度が低め（疲れ・落ち込み傾向） - 閾値を4.0未満に引き上げ
  if (avg_valence < 4.0 && avg_arousal <= 3.5) {
    return {
      hasSignificantEmotion: true,
      description: '少し疲れている様子、やや元気がない',
      emotionLabel: '疲労'
    };
  }

  // 快度が低い（一般的なネガティブ傾向）
  if (avg_valence < 3.7) {
    return {
      hasSignificantEmotion: true,
      description: 'やや沈んだ様子、感情的な負担の可能性',
      emotionLabel: '落ち込み'
    };
  }

  // 快度が高い場合
  if (avg_valence >= 4.3) {
    return {
      hasSignificantEmotion: true,
      description: 'ポジティブな気分、満足感',
      emotionLabel: '満足'
    };
  }

  // 覚醒度が低い（エネルギー低下）
  if (avg_arousal < 3.5) {
    return {
      hasSignificantEmotion: true,
      description: 'エネルギーが低め、やや疲れている可能性',
      emotionLabel: '疲労'
    };
  }

  // その他の場合
  return {
    hasSignificantEmotion: false,
    description: '特に顕著な感情的傾向は見られない状態',
    emotionLabel: '中立'
  };
}
